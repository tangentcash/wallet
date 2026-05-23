import { lazy, StrictMode, useEffect, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import { BrowserRouter, NavigateFunction, Route, Routes } from "react-router";
import { Box, Theme } from "@radix-ui/themes";
import { Chain, Messages, NetworkType, Pubkey, Pubkeyhash, Hashsig, RPC, SchemaUtil, Seckey, Signing, Stream, TransactionInput, TransactionOutput, Uint256, WalletKeychain, WalletType, Authorizer, Viewable, Hashing, ByteUtil, AssetId, Approving, AuthEntity, AuthApproval, Readability } from "tangentsdk";
import { AppStorage, BigStorage, SafeStorage, StorageField } from "./storage";
import { Alert, AlertBox, AlertType } from "./../components/alert";
import { Prompter, PrompterBox } from "../components/prompter";
import { Navbar } from "../components/navbar";
import Regtest from './../configs/regtest.json';
import Testnet from './../configs/testnet.json';
import Mainnet from './../configs/mainnet.json';
import BigNumber from "bignumber.js";

BigNumber.config({ DECIMAL_PLACES: 18, ROUNDING_MODE: 1 });
const RestorePage = lazy(() => import("./../pages/restore"));
const HomePage = lazy(() => import("./../pages/home"));
const ExplorerPage = lazy(() => import("./../pages/explorer"));
const HypePage = lazy(() => import("./../pages/hype"));
const LegalPage = lazy(() => import("./../pages/legal"));
const ErrorPage = lazy(() => import("./../pages/error"));
const ConfigurePage = lazy(() => import("./../pages/configure"));
const AccountPage = lazy(() => import("./../pages/account"));
const BlockPage = lazy(() => import("./../pages/block"));
const TransactionPage = lazy(() => import("./../pages/transaction"));
const ProgramPage = lazy(() => import("./../pages/program"));
const InteractionPage = lazy(() => import("./../pages/interaction"));
const PortfolioPage = lazy(() => import("../pages/exchange/portfolio"));
const OrderbookPage = lazy(() => import("../pages/exchange/orderbook"));

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
  time: Date | null;
  active: boolean;
};

export type AppState = {
  count: number,
  setState: Function | null,
  setNavigation: NavigateFunction | null
}

export type AppDefs = {
  cachePrefix: string | null,
  authorizer: boolean,
};

export type AppProps = {
  validator: string | null,
  exchange: string | null,
  account: string | null,
  appearance: 'dark' | 'light'
}

export enum AppPermission {
  ReadOnly,
  ReadWrite,
  Reset
}

export class AppData {
  static root: Root | null = null;
  static server: ConnectionState | null = null;
  static state: AppState = {
    count: 0,
    setState: null,
    setNavigation: null
  };
  static defs: AppDefs = {
    cachePrefix: null,
    authorizer: false,
  };
  static props: AppProps = {
    validator: null,
    exchange: null,
    account: null,
    appearance: 'dark'
  };
  static mayNotify: boolean = false;
  static platform: 'desktop' | 'mobile' | 'unknown' = 'unknown';
  static wallet: WalletKeychain | null = null;
  static tip: BigNumber | null = null;
  static tauriRef: any = null;
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
    this.props.account = this.wallet.address;
    this.save();
    return true;
  }
  private static nodeRequest(method: string, message: any, size: number): void {
    const bytes = 40 + size;
    if (AppData.server != null) {
      AppData.server.sentBytes += bytes;
      AppData.server.time = new Date();
      AppData.server.active = true;
      ++AppData.server.requests;
    } else {
      AppData.server = { sentBytes: bytes, receivedBytes: 0, requests: 1, responses: 0, time: new Date(), active: true };
    }
    
    console.log('[rpc]', `${method} call:`, message);
  }
  private static nodeResponse(method: string, message: any, size: number): void {
    const bytes = 40 + size;
    if (AppData.server != null) {
      AppData.server.receivedBytes += bytes;
      AppData.server.time = new Date();
      AppData.server.active = message != null && size > 0;
      ++AppData.server.responses;
    } else {
      AppData.server = { sentBytes: 0, receivedBytes: bytes, requests: 0, responses: 1, time: new Date(), active: true };
    }

    console.log('[rpc]', `${method} return:`, message);
  }
  private static nodeError(method: string, error: unknown): void {
    const bytes = 40 + (error as any)?.message?.length || 0;
    const message: string = ((error as any)?.message?.toString() || error?.toString()) || '';
    const networkError = !message.includes('layer_exception');
    if (AppData.server != null) {
      AppData.server.receivedBytes += bytes;
      AppData.server.time = new Date();
      AppData.server.active = !networkError;
      if (!networkError)
        ++AppData.server.responses;
    } else {
      AppData.server = { sentBytes: 0, receivedBytes: bytes, requests: 0, responses: networkError ? 0 : 1, time: new Date(), active: !networkError };
    }

    console.log('[rpc]', `${method} return:`, (error as any)?.message || error);
    AlertBox.open(AlertType.Error, `${method} error: ${(error as any)?.message || error}`);
  }
  private static async authorizerEvent(request: { event: string, id: number, payload: any}): Promise<boolean> {
    if (!this.defs.authorizer || PrompterBox.isOpen() || this.approveTransaction)
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
              this.state.setNavigation(`/interaction?type=approve&transaction=${ByteUtil.uint8ArrayToHexString(entity.sign.message || new Uint8Array())}${entity.sign.asset != null ? '&asset=' + entity.sign.asset.id : ''}`);
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

      const tauri = await this.tauri();
      const result: string[] = await tauri.invoke('resolve_domain_txt', {
        hostname: hostname
      });
      return result;
    } catch {
      return [];
    }
  }
  private static save(): void {
    AppStorage.set(StorageField.App, this.props);
  }
  private static render(): void {
    const element = document.getElementById("root") as HTMLElement;
    this.root = createRoot(element);
    if (this.isDev()) {
      this.root.render(
        <StrictMode>
          <App />
        </StrictMode>
      );
    } else {
      this.root.render(<App />);
    }
  }
  private static async tauri(): Promise<any> {
    if (!this.tauriRef) {
      const { core } = await import('@tauri-apps/api');
      this.tauriRef = core;
    }
    return this.tauriRef;
  }
  static async restoreWallet(passphrase: string, network?: NetworkType): Promise<boolean> {
    this.props.account = null;
    this.reconfigure(network || null, AppPermission.ReadWrite);
    this.save();

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
          if (!address || !this.storeWalletKeychain(WalletType.Address, address)) {
            return false;
          }
        }
      }
    }

    const address = this.getWalletAddress();
    RPC.applyTopics(address ? [address] : []);
    this.setState();
    return true;
  }
  static async resetWallet(secret: string | string[], type: WalletType, network?: NetworkType): Promise<boolean> {
    this.props.account = null;
    this.reconfigure(network || null, AppPermission.Reset);
    this.save();
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
    
    this.setState();
    return true;
  }
  static clearWallet(): void {
    SafeStorage.clear();
    this.wallet = null;
    this.setState();
  }
  static destroyWallet(): void {
    SafeStorage.wipe();
    this.wallet = null;
    this.props.account = null;
    this.setState();
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
    const layout = readType();
    const gasPrice = layout > Viewable.DecimalPos2 ? new BigNumber(0) : message.readDecimal(layout);
    const gasLimit = message.readInteger(layout > Viewable.DecimalPos2 ? layout : readType());
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

    const nonce = await RPC.getNextAccountNonce(address);
    const nextNonce = typeof nonce == 'string' ? new BigNumber(nonce, 16) : (nonce != null ? nonce : new BigNumber(0));
    try {
      if (!props.nonce)
        throw false;

      props.nonce = new BigNumber(props.nonce).integerValue(BigNumber.ROUND_DOWN);
      if (!props.nonce.gte(nextNonce))
        throw false;
    } catch {
      props.nonce = nextNonce;
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
    const props: AppProps | null = AppStorage.get(StorageField.App);
    if (this.isApp())
      this.tauri().then((tauri) => tauri.invoke('platform_type').then((value: string) => this.platform = value as 'desktop' | 'mobile' | 'unknown'));
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
      onCacheStore: (path: string, value: any): Promise<boolean> => BigStorage.set((this.defs.cachePrefix || 'V') + ':' + path, value),
      onCacheLoad: (path: string): Promise<any | null> => BigStorage.get((this.defs.cachePrefix || 'V') + ':' + path),
      onCacheKeys: (): Promise<string[]> => BigStorage.keys().then(x => x.filter((v) => v.startsWith((this.defs.cachePrefix || 'V'))).map((v) => v.substring((this.defs.cachePrefix || 'V').length + 1)))
    });
    this.reconfigure(null, AppPermission.ReadOnly);
    this.render();
    
    if (this.isApp()) {
      const { listen } = await import("@tauri-apps/api/event");
      listen('authorizer', (event: any) => this.authorizerEvent(event));
    }
  }
  static reconfigure(network: NetworkType | null, type: AppPermission): void {
    const prevNetwork = AppStorage.get(StorageField.Network) || this.defaultNetwork();
    network = network ? network : prevNetwork;

    let resetNetwork = type == AppPermission.Reset;
    if (network != null) {
      resetNetwork = resetNetwork || prevNetwork != network;
      if (type == AppPermission.ReadWrite && resetNetwork) {
        throw new Error('Must perform reset to change the network');
      }
      Chain.props = Chain[network];
      AppStorage.set(StorageField.Network, network);
    } 
      
    const config: { validatorUrl: string | null, exchangeUrl: string | null, cachePrefix: string | null, authorizer: boolean } = (() => {
      if (network != NetworkType.Regtest && network != NetworkType.Testnet && network != NetworkType.Mainnet)
        network = this.defaultNetwork();
      switch (network) {
        case NetworkType.Regtest:
          return Regtest;
        case NetworkType.Testnet:
          return Testnet;
        case NetworkType.Mainnet:
          return Mainnet;
        default:
          throw new Error('Invalid network');
      }
    })();
    const mustReset = resetNetwork || !AppStorage.get(StorageField.App);
    this.defs.cachePrefix = config.cachePrefix;
    this.defs.authorizer = config.authorizer;
    if (mustReset || !this.props.validator)
      this.props.validator = config.validatorUrl;
    if (mustReset || !this.props.exchange)
      this.props.exchange = config.exchangeUrl;
    if (resetNetwork)
      RPC.clearCache();
    
    const address = this.getWalletAddress();
    RPC.applyTopics(address ? [address] : []);
    RPC.applyValidator(this.props.validator);
    if (resetNetwork) {
      AppStorage.set(StorageField.Validator);
    }
  }
  static async openDevTools(): Promise<void> {
    if (this.isApp()) {
      const tauri = await this.tauri();
      tauri.invoke('open_devtools');
    }
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
  static removeSplashscreen(latency: number = 250): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const splashscreen = document.getElementById('splashscreen');
      if (splashscreen != null) {
        splashscreen.style.transition = `opacity ${latency}ms linear`;
        splashscreen.style.opacity = '0';
        setTimeout(() => {
          splashscreen.remove();
          resolve(true);
        }, latency);
      } else {
        resolve(false);
      }
    });
  }
  static saveFile(name: string, type: string, data: string): void {
    const link = document.createElement("a");
    document.body.appendChild(link);
    link.style.display = 'none';
    
    const target = window.URL.createObjectURL(new Blob([data], { type: type }));
    link.href = target;
    link.download = name;
    link.click();
    window.URL.revokeObjectURL(target);
    document.body.removeChild(link);
  }
  static setValidator(value: string | null): void {
    this.props.validator = value;
    RPC.applyValidator(this.props.validator);
    this.save();
  }
  static setExchange(value: string | null): void {
    this.props.exchange = value;
    this.save();
  }
  static setAppearance(value: 'dark' | 'light'): void {
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
    const account = this.isWalletReady() ? this.wallet?.address : null;
    return account || this.props.account;
  }
  static isWalletReady(): boolean {
    return this.wallet != null && this.wallet.isValid();
  }
  static isWalletExists(): boolean {
    return SafeStorage.hasEncryptedKey();
  }
  static isApp(): boolean {
    // @ts-ignore
    return !!window.__TAURI_INTERNALS__ || !!window.__TAURI__;
  }
  static isDev(): boolean {
    // @ts-ignore
    return import.meta.env.DEV;
  }
  static defaultNetwork(): NetworkType {
    return this.isDev() ? NetworkType.Regtest : NetworkType.Mainnet;
  }
}

export function App() {
  const [state, setState] = useState(0);
  AppData.state.setState = setState;
  useEffect(() => {
    const url = new URL(window.location.href);
    const forceAppearance = url.searchParams.get('appearance');
    if (forceAppearance == 'light' || forceAppearance == 'dark') {
      AppData.setAppearance(forceAppearance);
    }
    AppData.removeSplashscreen();
  }, []);

  return (
    <Theme appearance={AppData.props.appearance} accentColor="lime" radius="full" id={state.toString()}>
      <Box minHeight="100vh" minWidth="285px" style={{ paddingBottom: '96px' }}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={AppData.isWalletExists() ? <HomePage /> : (AppData.isApp() ? <RestorePage /> : <HypePage />)} />
            <Route path="/configure" element={<ConfigurePage />} />
            <Route path="/explorer" element={<ExplorerPage />} />
            <Route path="/interaction" element={<InteractionPage />} />
            <Route path="/block/:id" element={<BlockPage />} />
            <Route path="/transaction/:id" element={<TransactionPage />} />
            <Route path="/program/:id" element={<ProgramPage />} />
            <Route path="/account/:id" element={<AccountPage />} />
            <Route path="/restore" element={<RestorePage />} />
            <Route path="/app" element={<HypePage />} />
            <Route path="/legal" element={<LegalPage />} />
            <Route path="/orderbook/:orderbook" element={<OrderbookPage />} />
            <Route path="/portfolio/:account?" element={<PortfolioPage />} />
            <Route path="*" element={<ErrorPage />} />
          </Routes>
          <Navbar></Navbar>
        </BrowserRouter>
      </Box>
      <Alert></Alert>
      <Prompter></Prompter>
    </Theme>
  )
}