import { useState, StrictMode } from "react";
import { createRoot, Root } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { Box, Theme } from "@radix-ui/themes";
import { core } from '@tauri-apps/api';
import { Chain, ClearCallback, InterfaceProps, Messages, NetworkType, Pubkey, Pubkeyhash, Hashsig, RPC, SchemaUtil, Seckey, Signing, Stream, TransactionInput, TransactionOutput, Uint256, WalletKeychain, WalletType } from "tangentsdk";
import { SafeStorage, Storage, StorageField } from "./storage";
import { WalletReadyRoute, WalletNotReadyRoute } from "./../components/guards";
import { Alert, AlertBox, AlertType } from "./../components/alert";
import BigNumber from "bignumber.js";
import RestorePage from "./../pages/restore";
import HomePage from "./../pages/home";
import ConfigurePage from "./../pages/configure";
import AccountPage from "./../pages/account";
import BlockPage from "./../pages/block";
import TransactionPage from "./../pages/transaction";
import InteractionPage from "./../pages/interaction";
import DepositoryPage from "./../pages/depository"

const CACHE_PREFIX = 'cache';

export type ConnectionState = {
  sentBytes: number;
  receivedBytes: number;
  requests: number;
  responses: number;
  time: Date;
  active: boolean;
};

export type ServerState = {
  connections: Record<string, ConnectionState>
};

export type AppState = {
  count: number,
  setState: Function | null,
  setAppearance: Function | null
}

export type AppProps = {
  resolver: string | null,
  server: string | null,
  appearance: 'dark' | 'light'
}

export class AppData {
  static root: Root | null = null;
  static server: ServerState = {
    connections: { }
  };
  static state: AppState = {
    count: 0,
    setState: null,
    setAppearance: null
  };
  static props: AppProps = {
    resolver: 'nds.tangent.cash',
    server: '127.0.0.1:18419',
    appearance: 'dark'
  };
  static wallet: WalletKeychain | null = null;
  static tip: BigNumber | null = null;

  private static storeWalletKeychain(type: WalletType, secret: string | string[]): boolean {
    let data: WalletKeychain | null = null;
    switch (type) {
      case WalletType.Mnemonic: {
        if (!Array.isArray(secret))
          return false;

        data = WalletKeychain.fromMnemonic(secret);
        break;
      }
      case WalletType.SecretKey: {
        if (Array.isArray(secret))
          return false;

        data = WalletKeychain.fromSecretKey(secret);
        break;
      }
      case WalletType.PublicKey: {
        if (Array.isArray(secret))
          return false;

        data = WalletKeychain.fromPublicKey(secret);
        break;
      }
      case WalletType.Address: {
        if (Array.isArray(secret))
          return false;

        data = WalletKeychain.fromAddress(secret);
        break;
      }
    }

    if (!data || !data.isValid())
      return false;
    
    this.wallet = data;
    return true;
  }
  private static request(address: string, method: string, message: any, size: number): void {
    const bytes = 40 + size;
    const server = AppData.server.connections[address];
    if (server != null) {
      server.sentBytes += bytes;
      server.time = new Date();
      server.active = true;
      ++server.requests;
    } else {
      AppData.server.connections[address] = { sentBytes: bytes, receivedBytes: 0, requests: 1, responses: 0, time: new Date(), active: true };
    }
    
    console.log('[rpc]', `${address}${address.endsWith('/') ? '' : '/'}${method} call:`, message);
  }
  private static response(address: string, method: string, message: any, size: number): void {
    const bytes = 40 + size;
    const server = AppData.server.connections[address];
    if (server != null) {
      server.receivedBytes += bytes;
      server.time = new Date();
      server.active = message != null && size > 0;
      ++server.responses;
    } else {
      AppData.server.connections[address] = { sentBytes: 0, receivedBytes: bytes, requests: 0, responses: 1, time: new Date(), active: true };
    }

    console.log('[rpc]', `${address}${address.endsWith('/') ? '' : '/'}${method} return:`, message);
  }
  private static error(address: string, method: string, error: unknown): void {
    const bytes = 40 + (error as any)?.message?.length || 0;
    const server = AppData.server.connections[address];
    const message: string = ((error as any)?.message?.toString() || error?.toString()) || '';
    const networkError = !message.includes('layer_exception');
    if (server != null) {
      server.receivedBytes += bytes;
      server.time = new Date();
      server.active = !networkError;
      if (!networkError)
        ++server.responses;
    } else {
      AppData.server.connections[address] = { sentBytes: 0, receivedBytes: bytes, requests: 0, responses: networkError ? 0 : 1, time: new Date(), active: !networkError };
    }

    console.log('[rpc]', `${address}${address.endsWith('/') ? '' : '/'}${method} return:`, (error as any)?.message || error);
    AlertBox.open(AlertType.Error, `${address}${address.endsWith('/') ? '' : '/'}${method} error: ${(error as any)?.message || error}`);
  }
  private static save(): void {
    Storage.set(StorageField.Props, this.props);
  }
  private static render(): void {
    const element = document.getElementById("root") as HTMLElement;
    this.root = createRoot(element);
    this.root.render(<App />);
  }
  static async restoreWallet(passphrase: string, network?: NetworkType): Promise<boolean> {
    if (network != null) {
      Chain.props = Chain[network];
      Storage.set(StorageField.Network, network);
    } else {
      network = Storage.get(StorageField.Network);
      if (network == NetworkType.Mainnet || network == NetworkType.Testnet || network == NetworkType.Regtest)
        Chain.props = Chain[network];
    }
      
    const status = await SafeStorage.restore(passphrase);
    if (!status)
      return false;

    const mnemonic: string[] | null = await SafeStorage.get(StorageField.Mnemonic);
    if (!mnemonic || !this.storeWalletKeychain(WalletType.Mnemonic, mnemonic)) {
      const secretKey: string | null = await SafeStorage.get(StorageField.SecretKey);
      if (!secretKey || !this.storeWalletKeychain(WalletType.SecretKey, secretKey)) {
        const publicKey: string | null = await SafeStorage.get(StorageField.PublicKey);
        if (!publicKey || !this.storeWalletKeychain(WalletType.PublicKey, publicKey)) {
          const address: string | null = await SafeStorage.get(StorageField.Address);
          if (!address || !this.storeWalletKeychain(WalletType.Address, address))
            return false;
        }
      }
    }

    await this.stream();
    await this.sync();
    return true;
  }
  static async resetWallet(secret: string | string[], type: WalletType, network?: NetworkType): Promise<boolean> {
    if (network != null) {
      Chain.props = Chain[network];
      Storage.set(StorageField.Network, network);
    } else {
      network = Storage.get(StorageField.Network);
      if (network == NetworkType.Mainnet || network == NetworkType.Testnet || network == NetworkType.Regtest)
        Chain.props = Chain[network];
    }
    
    await SafeStorage.set(StorageField.Mnemonic);
    await SafeStorage.set(StorageField.SecretKey);
    await SafeStorage.set(StorageField.PublicKey);
    await SafeStorage.set(StorageField.Address);
    switch (type) {
      case WalletType.Mnemonic: {
        const status = await SafeStorage.set(StorageField.Mnemonic, secret);
        if (!status || !this.storeWalletKeychain(type, secret))
          return false;
        break;
      }
      case WalletType.SecretKey: {
        const status = await SafeStorage.set(StorageField.SecretKey, secret);
        if (!status || !this.storeWalletKeychain(type, secret))
          return false;
        break;
      }
      case WalletType.PublicKey: {
        const status = await SafeStorage.set(StorageField.PublicKey, secret);
        if (!status || !this.storeWalletKeychain(type, secret))
          return false;
        break;
      }
      case WalletType.Address: {
        const status = await SafeStorage.set(StorageField.Address, secret);
        if (!status || !this.storeWalletKeychain(type, secret))
          return false;
        break;
      }
      default:
        return false;
    }

    await this.stream();
    await this.sync();
    return true;
  }
  static clearWallet(callback: ClearCallback): any {
    SafeStorage.clear();
    this.wallet = null;
    return callback();
  }
  static async buildWalletTransaction(props: TransactionInput): Promise<TransactionOutput> {
    const address = this.getWalletAddress();
    if (!address)
      throw new Error('Account address is not available');

    const secretKey = this.getWalletSecretKey();
    if (!secretKey) {
      throw new Error('Account private key is not available');
    }

    try {
      if (!props.nonce)
        throw false;

      props.nonce = new BigNumber(props.nonce).integerValue(BigNumber.ROUND_DOWN);
      if (!props.nonce.gte(1))
        throw false;
    } catch {
      const nonce = await RPC.getNextAccountNonce(address);
      if (nonce == null) {
        throw new Error('Cannot fetch account nonce');
      } else {
        props.nonce = typeof nonce.max == 'string' ? new BigNumber(nonce.max, 16) : nonce.max;
      }
    }
    
    try {
      if (!props.gasPrice)
        throw false;

      props.gasPrice = new BigNumber(props.gasPrice);
      if (!props.gasPrice.gte(0))
        throw false;
    } catch {
      props.gasPrice = new BigNumber(0);
    }
    
    try {
      if (!props.gasLimit)
        throw false;

      props.gasLimit = new BigNumber(props.gasLimit).integerValue(BigNumber.ROUND_DOWN);
      if (!props.gasLimit.gt(0))
        throw false;
    } catch {
      props.gasLimit = new BigNumber(100_000);
    }

    const transaction = {
      signature: new Hashsig(),
      asset: props.asset,
      nonce: new Uint256(props.nonce.toString()),
      conservative: props.conservative || false,
      gasPrice: props.gasPrice,
      gasLimit: new Uint256(props.gasLimit.toString()),
      ...props.method.args
    };
    const stream = new Stream();
    SchemaUtil.store(stream, transaction, Messages.asSigningSchema(props.method.type));

    const signature = Signing.sign(stream.hash(), secretKey);
    if (!signature)
      throw new Error('Failed to sign a transaction');

    transaction.signature = signature;
    SchemaUtil.store(stream.clear(), transaction, props.method.type);
    return { hash: stream.hash().toHex(), data: stream.encode(), body: transaction };
  }
  static async buildWalletTransactionWithAutoGasLimit(props: TransactionInput): Promise<TransactionOutput> {
    const hasGasLimit = props.gasLimit != null;
    const intermediate = await this.buildWalletTransaction(props);
    if (hasGasLimit)
      return intermediate;

    try {
      let gas = await RPC.getOptimalTransactionGas(intermediate.data);
      if (typeof gas == 'string') {
        gas = new BigNumber(gas, 16);
      }

      if (!gas || !BigNumber.isBigNumber(gas) || !gas.gte(0)) {
        gas = await RPC.getEstimateTransactionGas(intermediate.data);
        if (typeof gas == 'string') {
          gas = new BigNumber(gas, 16);
        }
      }
      
      if (gas != null && BigNumber.isBigNumber(gas) && gas.gte(0)) {
        intermediate.body.gasLimit = new Uint256(gas.toString());
      } else {
        throw new Error('Cannot fetch transaction gas limit');
      }
    } catch (exception) {
      throw new Error('Cannot fetch transaction gas limit: ' + (exception as Error).message);
    }
    
    props.nonce = intermediate.body.nonce.toString();
    props.gasLimit = intermediate.body.gasLimit.toString();
    return await this.buildWalletTransaction(props);
  }
  static async stream(): Promise<number | null> {
    const address = this.getWalletAddress();
    if (!address)
      return null;

    return RPC.connectSocket([address]);
  }
  static async sync(): Promise<boolean> {
    try {
      const tipNumber = await RPC.getBlockTipNumber();
      if (typeof tipNumber == 'string')
        this.tip = new BigNumber(tipNumber, 16);
      else if (BigNumber.isBigNumber(tipNumber))
        this.tip = tipNumber;
      return true;
    } catch {
      return false;
    }
  }
  static async main(): Promise<void> {
    const props: AppProps | null = Storage.get(StorageField.Props);
    if (props != null)
      this.props = props;

    RPC.applyResolver(this.props.resolver);
    RPC.applyServer(this.props.server);
    RPC.applyImplementation({
      onNodeRequest: this.request,
      onNodeResponse: this.response,
      onNodeError: this.error,
      onCacheStore: (path: string, value: any): boolean => Storage.set(CACHE_PREFIX + ':' + path, value),
      onCacheLoad: (path: string): any | null => Storage.get(CACHE_PREFIX + ':' + path),
      onCacheKeys: (): string[] => Storage.keys().filter((v) => v.startsWith(CACHE_PREFIX)).map((v) => v.substring(CACHE_PREFIX.length + 1)),
      onIpsetLoad: (type: 'http' | 'ws'): string[] => Storage.get(type == 'ws' ? StorageField.Streaming : StorageField.Polling),
      onIpsetStore: (type: 'http' | 'ws', ipset: string[]) => Storage.set(type == 'ws' ? StorageField.Streaming : StorageField.Polling, ipset),
      onPropsLoad: (): InterfaceProps | null => Storage.get(StorageField.InterfaceProps) as InterfaceProps | null,
      onPropsStore: (props: InterfaceProps): boolean => Storage.set(StorageField.InterfaceProps, props)
    });
    if (true)
      await this.restoreWallet('123456', NetworkType.Regtest);
   
    const splashscreen = document.getElementById('splashscreen-content');
    if (splashscreen != null) {
      splashscreen.style.transition = 'opacity 250ms linear';
      splashscreen.style.opacity = '0';
      splashscreen.ontransitionend = () => this.render();
    } else {
      this.render();
    }
  }
  static openDevTools(): void {
    core.invoke('devtools');
  }
  static openFile(type: string): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = false;
      input.accept = type;
      input.onchange = (e) => {
        const target: any = e.target;
        if (target != null && target.files != null && target.files.length > 0) {
          const reader = new FileReader();
          reader.readAsText(target.files[0]);
          console.log(target.files[0])
          reader.onload = result => resolve(result.target != null && result.target.result != null ? result.target.result?.toString() : null);
          reader.onerror = () => resolve(null);
        }
        else
          resolve(null);
      };
      input.click();
    })
  }
  static saveFile(name: string, type: string, data: string): void {
    const link = document.createElement("a");
    document.body.appendChild(link);
    link.style = "display: none";
    
    const target = window.URL.createObjectURL(new Blob([data], { type: type }));
    link.href = target;
    link.download = name;
    link.click();
    window.URL.revokeObjectURL(target);
    document.body.removeChild(link);
  }
  static setResolver(value: string): void {
    this.props.resolver = value;
    RPC.applyResolver(this.props.resolver);
    this.save();
  }
  static setServer(value: string): void {
    this.props.server = value;
    RPC.applyServer(this.props.server);
    this.save();
  }
  static setAppearance(value: 'dark' | 'light'): void {
    this.props.appearance = value;
    if (this.state.setAppearance != null)
      this.state.setAppearance(value);
    this.save();
  }
  static setState(): void {
    if (this.state.setState != null)
      this.state.setState(++this.state.count);
  }
  static getWalletSecretKey(): Seckey | null | undefined {
    return this.isWalletReady() ? this.wallet?.secretKey : null;
  }
  static getWalletPublicKey(): Pubkey | null | undefined {
    return this.isWalletReady() ? this.wallet?.publicKey : null;
  } 
  static getWalletPublicKeyHash(): Pubkeyhash | null | undefined {
    return this.isWalletReady() ? this.wallet?.publicKeyHash : null;
  }
  static getWalletAddress(): string | null | undefined {
    return this.isWalletReady() ? this.wallet?.address : null;
  }
  static isWalletReady(): boolean {
    return this.wallet != null && this.wallet.isValid();
  }
  static isWalletExists(): boolean {
    return SafeStorage.hasEncryptedKey();
  }
}

export function App() {
  const [state, setState] = useState(0);
  const [appearance, setAppearance] = useState(AppData.props.appearance);
  // @ts-ignore
  const appearanceValue: 'dark' | 'light' = appearance;
  AppData.state.setState = setState;
  AppData.state.setAppearance = setAppearance;

  return (
    <StrictMode>
      <Theme appearance={appearanceValue} accentColor="iris" radius="full" id={state.toString()}>
        <Box minWidth="285px" maxWidth="800px" mx="auto" style={{ paddingBottom: '96px' }}>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={
                <WalletReadyRoute>
                  <HomePage />
                </WalletReadyRoute>
              } />
              <Route path="/configure" element={
                <WalletReadyRoute>
                  <ConfigurePage />
                </WalletReadyRoute>
              } />
              <Route path="/depository" element={
                <WalletReadyRoute>
                  <DepositoryPage />
                </WalletReadyRoute>
              } />
              <Route path="/interaction" element={
                <WalletReadyRoute>
                  <InteractionPage />
                </WalletReadyRoute>
              } />
              <Route path="/block/:id" element={
                <WalletReadyRoute>
                  <BlockPage />
                </WalletReadyRoute>
              } />
              <Route path="/transaction/:id" element={
                <WalletReadyRoute>
                  <TransactionPage />
                </WalletReadyRoute>
              } />
              <Route path="/account/:id" element={
                <WalletReadyRoute>
                  <AccountPage />
                </WalletReadyRoute>
              } />
              <Route path="/restore" element={
                <WalletNotReadyRoute>
                  <RestorePage />
                </WalletNotReadyRoute>
              } />
            </Routes>
          </BrowserRouter>
        </Box>
        <Alert></Alert>
      </Theme>
    </StrictMode>
  )
}