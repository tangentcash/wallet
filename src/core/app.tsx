import { useState } from "react";
import { createRoot, Root } from "react-dom/client";
import { BrowserRouter, NavigateFunction, Route, Routes } from "react-router";
import { Box, Theme } from "@radix-ui/themes";
import { core } from '@tauri-apps/api';
import { listen } from "@tauri-apps/api/event";
import { Chain, ClearCallback, InterfaceProps, Messages, NetworkType, Pubkey, Pubkeyhash, Hashsig, RPC, SchemaUtil, Seckey, Signing, Stream, TransactionInput, TransactionOutput, Uint256, WalletKeychain, WalletType, Authorizer, Viewable, Hashing, ByteUtil, AssetId, Approving, AuthEntity, AuthApproval, Readability } from "tangentsdk";
import { SafeStorage, Storage, StorageField } from "./storage";
import { WalletReadyRoute, WalletNotReadyRoute } from "./../components/guards";
import { Alert, AlertBox, AlertType } from "./../components/alert";
import { Prompter, PrompterBox } from "../components/prompter";
import Config from './../configs/config';
import BigNumber from "bignumber.js";
import RestorePage from "./../pages/restore";
import HomePage from "./../pages/home";
import ConfigurePage from "./../pages/configure";
import AccountPage from "./../pages/account";
import BlockPage from "./../pages/block";
import TransactionPage from "./../pages/transaction";
import InteractionPage from "./../pages/interaction";
import BridgePage from "./../pages/bridge"
import PortfolioPage from "../pages/swap/portfolio";
import ExplorerPage from "../pages/swap/explorer";
import OrderbookPage from "../pages/swap/orderbook";

const CACHE_PREFIX = 'cache';

export type DecodedTransaction = {
  typename: string,
  type: number,
  signature: Uint8Array,
  asset: AssetId,
  gasPrice: BigNumber,
  gasLimit: Uint256,
  nonce: number,
  instruction: Uint8Array
}

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
  setNavigation: NavigateFunction | null
}

export type AppProps = {
  resolver: string | null,
  server: string | null,
  authorizer: boolean,
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
    setNavigation: null
  };
  static props: AppProps = {
    resolver: Config.node.resolverUrl,
    server: Config.node.serverUrl,
    authorizer: Config.node.authorizer,
    appearance: 'dark'
  };
  static mayNotify: boolean = false;
  static styles: CSSStyleDeclaration | null = null;
  static platform: 'desktop' | 'mobile' | 'unknown' = 'unknown';
  static wallet: WalletKeychain | null = null;
  static tip: BigNumber | null = null;
  static approveTransaction: ((proof: { hash: Uint256, message: Uint8Array, signature: Hashsig } | null) => void) | null = null;

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
  private static nodeRequest(address: string, method: string, message: any, size: number): void {
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
  private static nodeResponse(address: string, method: string, message: any, size: number): void {
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
  private static nodeError(address: string, method: string, error: unknown): void {
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
  private static async authorizerEvent(request: { event: string, id: number, payload: any}): Promise<boolean> {
    if (!this.props.authorizer || PrompterBox.isOpen() || this.approveTransaction)
      return false;

    return await Authorizer.try(request.payload);
  }
  private static async authorizerPrompt(entity: AuthEntity): Promise<AuthApproval> {
    try {
      const result = await PrompterBox.open(entity);
      if (!result)
        throw new Error('User refused to proceed');

      const account = this.getWalletPublicKeyHash() || null;
      if (!account)
        throw new Error('User does not have a address');

      switch (entity.kind) {
        case Approving.account:
          AlertBox.open(AlertType.Info, `Account address sent to ${entity.proof.hostname}`);
          return {
            account: account,
            proof: {
              hash: null,
              message: null,
              signature: null
            }
          }
        case Approving.identity: {
          const secretKey = this.getWalletSecretKey();
          if (!secretKey)
            throw new Error('User does not have a secret key');

          const message = ByteUtil.byteStringToUint8Array(Authorizer.schema(entity, account));
          const messageHash = new Uint256(Hashing.hash256(message));
          const signature = Signing.sign(messageHash, secretKey);
          if (!signature)
            throw new Error('User failed to sign a message');

          AlertBox.open(AlertType.Info, `Ownership proof sent to ${entity.proof.hostname}`);
          return {
            account: account,
            proof: {
              hash: messageHash,
              message: message,
              signature: signature
            }
          }
        }
        case Approving.message: {
          if (!entity.sign.message)
            throw new Error('Invalid message to sign');

          const secretKey = this.getWalletSecretKey();
          if (!secretKey)
            throw new Error('User does not have a secret key');

          const messageHash = new Uint256(Hashing.hash256(entity.sign.message));
          const signature = Signing.sign(messageHash, secretKey);
          if (!signature)
            throw new Error('User failed to sign a message');

          AlertBox.open(AlertType.Info, `Message proof sent to ${entity.proof.hostname}`);
          return {
            account: account,
            proof: {
              hash: messageHash,
              message: entity.sign.message,
              signature: signature
            }
          }
        }
        case Approving.transaction: {
          if (!entity.sign.message)
            throw new Error('Invalid transaction to sign');

          if (this.approveTransaction)
            throw new Error('User is busy signing another transaction');

          const proof = await new Promise<{ hash: Uint256, message: Uint8Array, signature: Hashsig } | null>((resolve) => {
            if (this.state.setNavigation) {
              this.approveTransaction = resolve;
              this.state.setNavigation(`/interaction?type=approvetransaction&transaction=${ByteUtil.uint8ArrayToHexString(entity.sign.message || new Uint8Array())}${entity.sign.asset != null ? '&asset=' + entity.sign.asset.id : ''}`);
            } else {
              resolve(null);
            }
          });
          this.approveTransaction = null;
          if (!proof)
            throw new Error('User refused to sign and send a transaction');

          AlertBox.open(AlertType.Info, `Transaction proof sent to ${entity.proof.hostname}`);
          return {
            account: account,
            proof: {
              hash: proof.hash,
              message: proof.message,
              signature: proof.signature
            }
          };
        }
        default:
          throw new Error('Invalid kind of entity');
      }
    } catch (exception) {
      AlertBox.open(AlertType.Error, `Action from ${entity.proof.hostname} - approval denied`);
      throw exception;
    }
  }
  private static async authorizerDomain(hostname: string): Promise<string[]> {
    try {
      if (!this.isApp())
        return [];

      const result: string[] = await core.invoke('resolve_domain_txt', {
        hostname: hostname
      });
      return result;
    } catch {
      return [];
    }
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
  static decodeTransaction(data: string | Uint8Array): DecodedTransaction {
    const message = typeof data == 'string' ? Stream.decode(data) : new Stream(data);
    const readType = () => {
      const t = message.readType();
      return t == null ? Viewable.Invalid : t;
    };
    const type = message.readInteger(readType());
    const signature = message.readBinaryString(readType());
    const asset = message.readInteger(readType());
    const gasPrice = message.readDecimal(readType());
    const gasLimit = message.readInteger(readType());
    const nonce = message.readInteger(readType());
    if (type == null || signature == null || asset == null || gasPrice == null || gasLimit == null || nonce == null)
      throw new Error('Transaction data is malformed');

    const type32 = type.toInteger();
    const typename: string | null = Readability.toTransactionType(type32);
    if (typename?.toLowerCase() == 'non-standard')
      throw new Error('Transaction type ' + type.toCompactHex() + ' is not among valid ones');

    if (signature != null && signature.length != 0 && signature.length > Chain.size.HASHSIG)
      throw new Error('Transaction signature is not in valid format');

    if (nonce.gt(0) && !nonce.isSafeInteger())
      throw new Error('Transaction nonce is out of range');

    let targetSignature = signature;
    if (targetSignature.length < Chain.size.HASHSIG) {
      targetSignature = new Uint8Array(Chain.size.HASHSIG);
      targetSignature.set(signature);
      targetSignature.fill(0, signature.length);
    }

    return {
      typename: typename,
      type: type32,
      signature: targetSignature,
      asset: asset.gt(0) ? new AssetId(asset.toUint8Array()) : new AssetId(),
      gasPrice: gasPrice,
      gasLimit: gasLimit,
      nonce: nonce.toInteger(),
      instruction: message.data.slice(message.seek)
    }
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
      props.gasLimit = new BigNumber(1_000_000);
    }

    const transaction = {
      signature: new Hashsig(),
      asset: props.asset,
      nonce: new Uint256(props.nonce.toString()),
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
    return { hash: stream.hash().toHex(), data: stream.encode(), body: transaction, receipt: null };
  }
  static async buildWalletTransactionWithAutoGasLimit(props: TransactionInput): Promise<TransactionOutput> {
    const hasGasLimit = props.gasLimit != null;
    const intermediate = await this.buildWalletTransaction(props);
    if (hasGasLimit)
      return intermediate;

    let receipt = null;
    try {
      receipt = await RPC.simulateTransaction(intermediate.data);
      if (!receipt)
        throw new Error('failed to fetch the receipt');

      receipt.relative_gas_use = typeof receipt.relative_gas_use == 'string' ? new BigNumber(receipt.relative_gas_use, 16) : receipt.relative_gas_use;
      if (receipt.relative_gas_use != null && BigNumber.isBigNumber(receipt.relative_gas_use) && receipt.relative_gas_use.gte(0)) {
        intermediate.body.gasLimit = new Uint256(receipt.relative_gas_use.toString());
      } else {
        throw new Error('Cannot fetch transaction gas limit');
      }
    } catch (exception) {
      throw new Error('Cannot fetch transaction gas limit: ' + (exception as Error).message);
    }
    
    props.nonce = intermediate.body.nonce.toString();
    props.gasLimit = intermediate.body.gasLimit.toString();
    const result = await this.buildWalletTransaction(props);
    if (result != null)
      result.receipt = receipt;
    return result;
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
    if (this.isApp())
      core.invoke('platform_type').then((value) => this.platform = value as 'desktop' | 'mobile' | 'unknown');
    if (props != null)
      this.props = props;

    Authorizer.applyImplementation({
      prompt: (entity) => this.authorizerPrompt(entity),
      resolveDomainTXT: this.authorizerDomain
    });
    RPC.applyImplementation({
      onNodeRequest: this.nodeRequest,
      onNodeResponse: this.nodeResponse,
      onNodeError: this.nodeError,
      onCacheStore: (path: string, value: any): boolean => Storage.set(CACHE_PREFIX + ':' + path, value),
      onCacheLoad: (path: string): any | null => Storage.get(CACHE_PREFIX + ':' + path),
      onCacheKeys: (): string[] => Storage.keys().filter((v) => v.startsWith(CACHE_PREFIX)).map((v) => v.substring(CACHE_PREFIX.length + 1)),
      onIpsetLoad: (type: 'http' | 'ws'): string[] => Storage.get(type == 'ws' ? StorageField.Streaming : StorageField.Polling),
      onIpsetStore: (type: 'http' | 'ws', ipset: string[]) => Storage.set(type == 'ws' ? StorageField.Streaming : StorageField.Polling, ipset),
      onPropsLoad: (): InterfaceProps | null => Storage.get(StorageField.InterfaceProps) as InterfaceProps | null,
      onPropsStore: (props: InterfaceProps): boolean => Storage.set(StorageField.InterfaceProps, props)
    });
    RPC.applyResolver(this.props.resolver);
    RPC.applyServer(this.props.server);
    if (Config.wallet.password != null && Config.wallet.password.length > 0 && Config.wallet.network.length > 0)
      await this.restoreWallet(Config.wallet.password, Config.wallet.network as NetworkType);
   
    const splashscreen = document.getElementById('splashscreen-content');
    if (splashscreen != null) {
      splashscreen.style.transition = 'opacity 250ms linear';
      splashscreen.style.opacity = '0';
      splashscreen.ontransitionend = () => this.render();
    } else {
      this.render();
    }
    
    if (this.isApp())
      await listen('authorizer', (event) => this.authorizerEvent(event));
  }
  static openDevTools(): void {
    if (this.isApp())
      core.invoke('open_devtools');
  }
  static openFile(type: string): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = false;
      input.accept = type;
      input.onchange = (e) => {
        const target: any = e.target;
        if (target != null && target.files != null && target.files.length > 0) {
          const reader = new FileReader();
          reader.readAsArrayBuffer(target.files[0]);
          reader.onload = result => {
            const buffer: ArrayBuffer | null = result.target != null && result.target.result instanceof ArrayBuffer ? result.target.result as ArrayBuffer : null;
            resolve(buffer != null ? new Uint8Array(buffer) : null);
          };
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
    this.styles = null;
    this.props.appearance = value;
    this.save();
    this.setState();
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
  static isApp(): boolean {
    return core.isTauri();
  }
  static styleOf(property: string): string | undefined {
    if (!this.styles) {
      const element = document.querySelector('.radix-themes')
      if (element != null)
        this.styles = getComputedStyle(element);
    }
    return this.styles?.getPropertyValue(property) || undefined;
  }
}

export function App() {
  const [state, setState] = useState(0);
  AppData.state.setState = setState;

  return (
    <Theme appearance={AppData.props.appearance} accentColor="iris" radius="full" id={state.toString()}>
      <Box minWidth="285px" style={{ paddingBottom: '96px' }}>
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
            <Route path="/bridge" element={
              <WalletReadyRoute>
                <BridgePage />
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
            <Route path="/swap" element={
              <WalletReadyRoute>
                <PortfolioPage />
              </WalletReadyRoute>
            } />
            <Route path="/swap/explorer" element={
              <WalletReadyRoute>
                <ExplorerPage />
              </WalletReadyRoute>
            } />
            <Route path="/swap/orderbook/:orderbook?" element={
              <WalletReadyRoute>
                <OrderbookPage />
              </WalletReadyRoute>
            } />
          </Routes>
        </BrowserRouter>
      </Box>
      <Alert></Alert>
      <Prompter></Prompter>
    </Theme>
  )
}