import BigNumber from "bignumber.js";
import { SafeStorage, Storage, StorageField } from "./storage";
import { AssetId, ByteUtil, Chain, Hashing, Pubkey, Pubkeyhash, Seckey, Sighash, Signing, Uint256 } from "./tangent/algorithm";
import { Ledger, Messages, States } from "./tangent/schema";
import { SchemaUtil, Stream } from "./tangent/serialization";

const DEFAULT_DISCOVERERS = ['nds.tanchain.org'];
const DEFAULT_INTERFACES = ['127.0.0.1:18419'];
const CACHE_PREFIX = 'cache';
const WEBSOCKET_TIMEOUT = 24000;

export type FetchAllCallback<T> = (offset: number, count: number) => Promise<T[] | null>;
export type ReportCallback = (address: string, method: string, error: unknown) => void;
export type RequestCallback = (address: string, method: string, message: any, size: number) => void;
export type ResponseCallback = (address: string, method: string, message: any, size: number) => void;
export type StreamingCallback = (event: { type: string, result: any }) => void;
export type PromiseCallback = (data: any) => void;
export type ClearCallback = () => any;

export type SummaryState = {
  witnesses: {
    addresses: Record<string, { asset: AssetId, index: BigNumber, aliases: string[] }>
    transactions: Record<string, { asset: AssetId, transactionId: string }[]>
  },
  contributions: Record<string, Record<string, { asset: AssetId, custody: BigNumber, coverage: BigNumber }>>,
  balances: Record<string, Record<string, { asset: AssetId, supply: BigNumber, reserve: BigNumber, balance: BigNumber }>>,
  errors: string[]
};

export type TransactionInput = {
  asset: AssetId;
  conservative?: boolean;
  sequence?: string | number | BigNumber;
  gasPrice?: string | number | BigNumber;
  gasLimit?: string | number | BigNumber;
  method: {
    type: Ledger.Transaction,
    args: { [key: string]: any }
  }
}

export type TransactionOutput = {
  hash: string,
  data: string,
  body: {
    signature: Sighash,
    asset: AssetId,
    sequence: Uint256,
    conservative: boolean,
    gasPrice: BigNumber,
    gasLimit: Uint256
  } & { [key: string]: any }
}

export enum WalletType {
  Mnemonic = 'mnemonic',
  PrivateKey = 'privatekey',
  PublicKey = 'publickey',
  Address = 'address'
}

export enum NetworkType {
  Mainnet = 'mainnet',
  Testnet = 'testnet',
  Regtest = 'regtest'
}

export class InterfaceProps {
  streaming: boolean = true;
}

class Keychain {
  type: WalletType | null = null;
  privateKey: Seckey | null = null;
  publicKey: Pubkey | null = null;
  publicKeyHash: Pubkeyhash | null = null;
  address: string | null = null;

  isValid(): boolean {
    switch (this.type) {
      case WalletType.Mnemonic:
      case WalletType.PrivateKey:
        return this.privateKey != null && this.publicKey != null && this.publicKeyHash != null && this.address != null;
      case WalletType.PublicKey:
        return this.publicKey != null && this.publicKeyHash != null && this.address != null;
      case WalletType.Address:
        return this.publicKeyHash != null && this.address != null;
      default:
        return false;
    }
  }
  static fromMnemonic(mnemonic: string[]): Keychain | null {
    if (mnemonic.length != 24)
      return null;

    const privateKey = Signing.derivePrivateKeyFromMnemonic(mnemonic.join(' '));
    if (!privateKey)
      return null;

    const serialized = Signing.encodePrivateKey(privateKey);
    if (!serialized)
      return null;

    const result = this.fromPrivateKey(serialized);
    if (!result)
      return null;

    result.type = WalletType.Mnemonic;
    return result;
  }
  static fromPrivateKey(privateKey: string): Keychain | null {
    const result = new Keychain();
    result.type = WalletType.PrivateKey;
    result.privateKey = Signing.decodePrivateKey(privateKey);
    if (!result.privateKey)
        return null;

    const publicKey = Signing.derivePublicKey(result.privateKey);
    if (!publicKey)
      return null;
    
    result.publicKey = Signing.deriveTweakedPublicKey(publicKey);
    if (!result.publicKey)
      return null;

    result.publicKeyHash = Signing.derivePublicKeyHash(result.publicKey);
    if (!result.publicKeyHash)
      return null;

    result.address = Signing.encodeAddress(result.publicKeyHash);
    return result;
  }
  static fromPublicKey(publicKey: string): Keychain | null {
    const result = new Keychain();
    result.type = WalletType.PublicKey;
    result.publicKey = Signing.decodePublicKey(publicKey);
    if (!result.publicKey)
      return null;

    result.publicKeyHash = Signing.derivePublicKeyHash(result.publicKey);
    if (!result.publicKeyHash)
      return null;

    result.address = Signing.encodeAddress(result.publicKeyHash);
    return result;
  }
  static fromAddress(address: string): Keychain | null {
    const result = new Keychain();
    result.type = WalletType.Address;
    result.address = address;
    result.publicKeyHash = Signing.decodeAddress(result.address);
    if (!result.publicKeyHash)
      return null;

    return result;
  }
}

export class Netstat {
  static blockTipNumber: BigNumber | null = null;

  static async stream(): Promise<number | null> {
    return Interface.connectSocket();
  }
  static async sync(): Promise<boolean> {
    try {
      const tipNumber = await Interface.getBlockTipNumber();
      if (typeof tipNumber == 'string')
        this.blockTipNumber = new BigNumber(tipNumber, 16);
      else if (tipNumber instanceof BigNumber)
        this.blockTipNumber = tipNumber;
      return true;
    } catch {
      return false;
    }
  }
}

export class Wallet {
  private static data: Keychain | null = null;

  private static storeKeychain(type: WalletType, secret: string | string[]): boolean {
    let data: Keychain | null = null;
    switch (type) {
      case WalletType.Mnemonic: {
        if (!Array.isArray(secret))
          return false;

        data = Keychain.fromMnemonic(secret);
        break;
      }
      case WalletType.PrivateKey: {
        if (Array.isArray(secret))
          return false;

        data = Keychain.fromPrivateKey(secret);
        break;
      }
      case WalletType.PublicKey: {
        if (Array.isArray(secret))
          return false;

        data = Keychain.fromPublicKey(secret);
        break;
      }
      case WalletType.Address: {
        if (Array.isArray(secret))
          return false;

        data = Keychain.fromAddress(secret);
        break;
      }
    }

    if (!data || !data.isValid())
      return false;
    
    this.data = data;
    return true;
  }
  static async restore(passphrase: string, network?: NetworkType): Promise<boolean> {
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
    if (!mnemonic || !this.storeKeychain(WalletType.Mnemonic, mnemonic)) {
      const privateKey: string | null = await SafeStorage.get(StorageField.PrivateKey);
      if (!privateKey || !this.storeKeychain(WalletType.PrivateKey, privateKey)) {
        const publicKey: string | null = await SafeStorage.get(StorageField.PublicKey);
        if (!publicKey || !this.storeKeychain(WalletType.PublicKey, publicKey)) {
          const address: string | null = await SafeStorage.get(StorageField.Address);
          if (!address || !this.storeKeychain(WalletType.Address, address))
            return false;
        }
      }
    }

    await Netstat.stream();
    await Netstat.sync();
    return true;
  }
  static async reset(secret: string | string[], type: WalletType, network?: NetworkType): Promise<boolean> {
    if (network != null) {
      Chain.props = Chain[network];
      Storage.set(StorageField.Network, network);
    } else {
      network = Storage.get(StorageField.Network);
      if (network == NetworkType.Mainnet || network == NetworkType.Testnet || network == NetworkType.Regtest)
        Chain.props = Chain[network];
    }
    
    await SafeStorage.set(StorageField.Mnemonic);
    await SafeStorage.set(StorageField.PrivateKey);
    await SafeStorage.set(StorageField.PublicKey);
    await SafeStorage.set(StorageField.Address);
    switch (type) {
      case WalletType.Mnemonic: {
        const status = await SafeStorage.set(StorageField.Mnemonic, secret);
        if (!status || !this.storeKeychain(type, secret))
          return false;
        break;
      }
      case WalletType.PrivateKey: {
        const status = await SafeStorage.set(StorageField.PrivateKey, secret);
        if (!status || !this.storeKeychain(type, secret))
          return false;
        break;
      }
      case WalletType.PublicKey: {
        const status = await SafeStorage.set(StorageField.PublicKey, secret);
        if (!status || !this.storeKeychain(type, secret))
          return false;
        break;
      }
      case WalletType.Address: {
        const status = await SafeStorage.set(StorageField.Address, secret);
        if (!status || !this.storeKeychain(type, secret))
          return false;
        break;
      }
      default:
        return false;
    }

    await Netstat.stream();
    await Netstat.sync();
    return true;
  }
  static clear(callback: ClearCallback): any {
    SafeStorage.clear();
    this.data = null;
    return callback();
  }
  static async buildTransaction(props: TransactionInput): Promise<TransactionOutput> {
    const address = this.getAddress();
    if (!address)
      throw new Error('Account address is not available');

    const privateKey = Wallet.getPrivateKey();
    if (!privateKey) {
      throw new Error('Account private key is not available');
    }

    try {
      if (!props.sequence)
        throw false;

      props.sequence = new BigNumber(props.sequence).integerValue(BigNumber.ROUND_DOWN);
      if (!props.sequence.gte(1))
        throw false;
    } catch {
      const sequence = await Interface.getNextAccountSequence(address);
      if (sequence == null) {
        throw new Error('Cannot fetch account sequence');
      } else {
        props.sequence = typeof sequence.max == 'string' ? new BigNumber(sequence.max, 16) : sequence.max;
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
      signature: new Sighash(),
      asset: props.asset,
      sequence: new Uint256(props.sequence.toString()),
      conservative: props.conservative || false,
      gasPrice: props.gasPrice,
      gasLimit: new Uint256(props.gasLimit.toString()),
      ...props.method.args
    };
    const stream = new Stream();
    SchemaUtil.store(stream, transaction, Messages.asSigningSchema(props.method.type));

    const signature = Signing.signTweaked(stream.hash(), privateKey);
    if (!signature)
      throw new Error('Failed to sign a transaction');

    transaction.signature = signature;
    SchemaUtil.store(stream.clear(), transaction, props.method.type);
    return { hash: stream.hash().toHex(), data: stream.encode(), body: transaction };
  }
  static async buildTransactionWithAutoGasLimit(props: TransactionInput): Promise<TransactionOutput> {
    const hasGasLimit = props.gasLimit != null;
    const intermediate = await Wallet.buildTransaction(props);
    if (hasGasLimit)
      return intermediate;

    try {
      let gas = await Interface.getOptimalTransactionGas(intermediate.data);
      if (typeof gas == 'string') {
        gas = new BigNumber(gas, 16);
      }

      if (!gas || !(gas instanceof BigNumber) || !gas.gte(0)) {
        gas = await Interface.getEstimateTransactionGas(intermediate.data);
        if (typeof gas == 'string') {
          gas = new BigNumber(gas, 16);
        }
      }
      
      if (gas != null && gas instanceof BigNumber && gas.gte(0)) {
        intermediate.body.gasLimit = new Uint256(gas.toString());
      } else {
        throw new Error('Cannot fetch transaction gas limit');
      }
    } catch (exception) {
      throw new Error('Cannot fetch transaction gas limit: ' + (exception as Error).message);
    }
    
    props.sequence = intermediate.body.sequence.toString();
    props.gasLimit = intermediate.body.gasLimit.toString();
    return await Wallet.buildTransaction(props);
  }
  static getPrivateKey(): Seckey | null | undefined {
    return this.isReady() ? this.data?.privateKey : null;
  }
  static getPublicKey(): Pubkey | null | undefined {
    return this.isReady() ? this.data?.publicKey : null;
  } 
  static getPublicKeyHash(): Pubkeyhash | null | undefined {
    return this.isReady() ? this.data?.publicKeyHash : null;
  }
  static getAddress(): string | null | undefined {
    return this.isReady() ? this.data?.address : null;
  }
  static isReady(): boolean {
    return this.data != null && this.data.isValid();
  }
  static isExists(): boolean {
    return SafeStorage.hasEncryptedKey();
  }
}

export class Interface {
  static discoverers = {
    online: new Set<string>(DEFAULT_DISCOVERERS),
    offline: new Set<string>()
  };
  static httpInterfaces = {
    online: new Set<string>(DEFAULT_INTERFACES),
    offline: new Set<string>(),
    preload: false
  };
  static wsInterfaces = {
    online: new Set<string>(DEFAULT_INTERFACES),
    offline: new Set<string>(),
    preload: false
  };
  static requests = {
    pending: new Map<string, { method: string, resolve: PromiseCallback } >(),
    count: 0
  };
  static props = {
    data: new InterfaceProps(),
    preload: false
  };
  static socket: WebSocket | null = null;
  static onNotification: StreamingCallback | null = null;
  static onNodeRequest: RequestCallback | null = null;
  static onNodeResponse: ResponseCallback | null = null;
  static onNodeError: ReportCallback | null = null;

  private static fetchObject(data: any): any {
    if (typeof data == 'string') {
      try {
        const numeric = new BigNumber(data, 10);
        if (numeric.toString() == data)
          return numeric;
      } catch { }
    }
    else if (typeof data == 'number') {
      return new BigNumber(data);
    }
    else if (typeof data == 'object') {
      for (let key in data) {
        data[key] = this.fetchObject(data[key]);
      }
    } else if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        data[i] = this.fetchObject(data[i]);
      }
    }
    return data;
  }
  private static fetchData(data: any): any {
    if (!data.error)
      return this.fetchObject(data.result)

    return new Error((data.error.message ? data.error.message : '') + ' causing layer_exception::type' + (data.error.code ? data.error.code.toString() : ''));
  }
  private static fetchResult(hash: string, data: any): any[] | undefined {    
    if (Array.isArray(data) || data.result === undefined) {
      return undefined;
    } else if (hash != null && data.error == null)
      Storage.set(CACHE_PREFIX + ':' + hash, data.result);
    return this.fetchData(data);   
  }
  private static fetchNode(type: 'ws' | 'http'): [string, string] | null {
    try {
      const nodes = Array.from(type == 'ws' ? this.wsInterfaces.online.keys() : this.httpInterfaces.online.keys());
      const node = nodes[Math.floor(Math.random() * nodes.length)];
      const location = new URL('tcp://' + node);
      const secure = (location.port == '443');
      return [`${type}${secure ? 's' : ''}://${node}/`, node];
    } catch {
      return null;
    }
  }
  private static fetchDiscoverer(type: 'ws' | 'http'): [string, string] | null {
    try {
      const nodes = Array.from(this.discoverers.online.keys());
      const node = nodes[Math.floor(Math.random() * nodes.length)];
      const location = new URL('tcp://' + node);
      const secure = (location.port == '443');
      return [`${secure ? 'https' : 'http'}://${node}/?interface=1&public=1${type == 'ws' ? '&streaming=1' : ''}`, node];
    } catch {
      return null;
    }
  }
  private static async fetchIpset(type: 'ws' | 'http', mode: 'preload' | 'fetch'): Promise<number> {
    const interfaces = type == 'ws' ? this.wsInterfaces : this.httpInterfaces;
    switch (mode) {
      case 'preload': {
        if (interfaces.preload)
          return 0;
        
        const seeds = Storage.get(type =='ws' ? StorageField.Streaming : StorageField.Polling);
        interfaces.preload = true;
        if (!seeds || !Array.isArray(seeds) || !seeds.length)
          return 0;

        let results = 0;
        for (let i = 0; i < seeds.length; i++) {
          try {
            const seed = seeds[i];
            const scheme = new URL('tcp://' + seed);
            const address = scheme.hostname + (scheme.port.length > 0 ? ':' + scheme.port : '');
            if (seed.length > 0 && address.length > 0 && !interfaces.online.has(address) && !interfaces.offline.has(address)) {
              interfaces.online.add(address);
              ++results;
            }
          } catch { }
        }
        
        return results;
      }
      case 'fetch': {
        while (this.discoverers.offline.size < this.discoverers.online.size) {
          const location = this.fetchDiscoverer(type);
          if (!location)
            continue;
        
          try {
            if (this.onNodeRequest)
              this.onNodeRequest(location[0], 'discover', null, 0);
    
            const response = await fetch(location[0]);
            const dataContent = await response.text();
            const data = JSON.parse(dataContent);
            if (this.onNodeResponse)
              this.onNodeResponse(location[0], 'discover', data, dataContent.length);
    
            if (!Array.isArray(data))
              throw false;
    
            let results = 0;
            for (let i = 0; i < data.length; i++) {
              try {
                const seed = data[i];
                const scheme = new URL(seed);
                const address = scheme.hostname + (scheme.port.length > 0 ? ':' + scheme.port : '');
                if (seed.length > 0 && address.length > 0 && !interfaces.online.has(address) && !interfaces.offline.has(address)) {
                  interfaces.online.add(address);
                  ++results;
                }
              } catch { }
            }
    
            if (results > 0)
              return results;
            else
              continue;
          } catch (exception) {
            if (this.onNodeResponse)
              this.onNodeResponse(location[0], 'discover', exception, (exception as Error).message.length);
          }
    
          this.discoverers.online.delete(location[1]);
          this.discoverers.offline.add(location[1]);
        }
    
        if (this.discoverers.offline.size >= this.discoverers.online.size) {
            this.discoverers.online = new Set<string>([...this.discoverers.online, ...this.discoverers.offline]);
            this.discoverers.offline.clear();
        }
    
        Storage.set(type =='ws' ? StorageField.Streaming : StorageField.Polling, [...interfaces.online, ...interfaces.offline]);
        return 0;
      }
      default:
        return 0;
    }
  }
  static async fetch<T>(policy: 'cache' | 'no-cache', method: string, args?: any[]): Promise<T | null> {
    const id = (++this.requests.count).toString();
    const hash = ByteUtil.uint8ArrayToHexString(Hashing.hash512(ByteUtil.utf8StringToUint8Array(JSON.stringify([method, args || []]))));
    const body = {
      jsonrpc: '2.0',
      id: id,
      method: method,
      params: Array.isArray(args) ? args : []
    };
    const content = JSON.stringify(body);
    if (policy == 'cache') {
      const cache = Storage.get(CACHE_PREFIX + ':' + hash);
      if (cache != null)
        return this.fetchObject(cache);
    }

    if (this.socket != null) {
      let result = undefined;
      try {
        if (this.onNodeRequest)
          this.onNodeRequest(this.socket.url, method, body, content.length);

        const data: [any, number] = await new Promise((resolve, reject) => {
          const context = { method: method, resolve: (_: any) => { } };
          const timeout = setTimeout(() => context.resolve(new Error('connection timed out')), WEBSOCKET_TIMEOUT);
          context.resolve = (data: [any, number] | Error) => {
            this.requests.pending.delete(id);
            clearTimeout(timeout);
            if (data instanceof Error)
              reject(data);
            else
              resolve(data);
          };
          this.requests.pending.set(id, context);
          if (this.socket != null)
            this.socket.send(content);
          else
            context.resolve(new Error('connection reset'));
        });
        if (this.onNodeResponse)
          this.onNodeResponse(this.socket?.url || '[unknown]', method, data[0], data[1]);
        
        result = this.fetchResult(hash, data[0]);
      } catch (exception) {
        if (this.onNodeError)
          this.onNodeError(this.socket?.url || '[unknown]', method, exception);
      }
        
      if (result !== undefined) {
        if (result instanceof Error)
          throw result;
        return result as T;
      }
    }

    await this.fetchIpset('http', 'preload');
    while (this.httpInterfaces.offline.size < this.httpInterfaces.online.size) {
      const location = this.fetchNode('http');
      if (location != null) {
        let result = undefined;
        try {
          if (this.onNodeRequest)
            this.onNodeRequest(location[0], method, body, content.length);
  
          const response = await fetch(location[0], {
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            body: content,
          });
          const dataContent = await response.text();
          const data = JSON.parse(dataContent);
          if (this.onNodeResponse)
            this.onNodeResponse(location[0], method, data, dataContent.length);

          result = this.fetchResult(hash, data);
        } catch (exception) {
          if (this.onNodeError)
            this.onNodeError(location[0], method, exception);
        }
        
        if (result !== undefined) {
          if (result instanceof Error)
            throw result;
          return result as T;
        }

        this.httpInterfaces.online.delete(location[1]);
        this.httpInterfaces.offline.add(location[1]);
      } else {
        const found = await this.fetchIpset('http', 'fetch');
        if (!found) {
          break;
        }
      }
    }

    if (this.httpInterfaces.offline.size >= this.httpInterfaces.online.size) {
      const found = await this.fetchIpset('http', 'fetch');
      if (!found) {
        this.httpInterfaces.online = new Set<string>([...this.httpInterfaces.online, ...this.httpInterfaces.offline]);
        this.httpInterfaces.offline.clear();
      }
    }

    const cache = Storage.get(CACHE_PREFIX + ':' + hash);
    if (cache != null)
      return this.fetchObject(cache);

    return null;
  }
  static async fetchAll<T>(callback: FetchAllCallback<T>): Promise<T[] | null> {
    const count = 48;
    let result: T[] = [];
    let offset = 0;
    while (true) {
      try {
        const data = await callback(offset, count);
        if (data == null)
          return null;
        else if (!Array.isArray(data) || !data.length)
          break;
  
        offset += data.length;
        result = result.concat(data);
        if (data.length < count)
          break;
      } catch (exception) {
        if (result.length > 0)
          break;
        
        throw exception;
      }
    }
    return result;
  }
  static async connectSocket(): Promise<number | null> {
    if (this.socket != null)
      return 0;
    else if (!this.getProps().streaming)
      return null;
    
    const address = Wallet.getAddress();
    if (!address)
      return null;
    
    const method = 'connect';
    await this.fetchIpset('ws', 'preload');
    while (this.wsInterfaces.offline.size < this.wsInterfaces.online.size) {
      const location = this.fetchNode('ws');
      if (location != null) {
        try {
          if (this.onNodeRequest)
            this.onNodeRequest(location[0], method, null, 0);
  
          const connection = await new Promise<WebSocket>((resolve, reject) => {
            const socket = new WebSocket(location[0]);
            socket.onopen = () => resolve(socket);
            socket.onerror = () => reject(new Error('websocket connection error'));
          });
          if (this.onNodeResponse)
            this.onNodeResponse(location[0], method, null, 0);

          this.socket = connection;
          this.socket.onopen = null;
          this.socket.onerror = null;
          this.socket.onmessage = (event) => {
            const message = event.data;
            if (!this.socket || typeof message != 'string')
              return;

            try {
              const data: any = JSON.parse(message);
              if (data != null && typeof data.id != 'undefined') {
                if (typeof data.notification == 'object') {
                  const notification = data.notification;
                  if (notification != null && typeof notification.type == 'string' && typeof notification.result != 'undefined') {
                    if (this.onNotification)
                      this.onNotification(notification);
                    if (this.onNodeResponse)
                      this.onNodeResponse(this.socket.url, 'notification', data, message.length);
                  }
                } else if (typeof data.result != 'undefined' && data.id != null) {
                  const response = this.requests.pending.get(data.id.toString());
                  if (response != null)
                    response.resolve([data, message.length]);
                }
              }
            } catch { }
          };
          this.socket.onclose = () => {
            this.disconnectSocket();
            this.connectSocket();
          };
          const events = await this.fetch<number>('no-cache', 'subscribe', [address]);
          return events;
        } catch (exception) {
          if (this.onNodeResponse)
            this.onNodeResponse(location[0], method, exception, (exception as Error).message.length);
        }

        this.wsInterfaces.online.delete(location[1]);
        this.wsInterfaces.offline.add(location[1]);
      } else {
        const found = await this.fetchIpset('ws', 'fetch');
        if (!found) {
          break;
        }
      }
    }

    if (this.wsInterfaces.offline.size >= this.wsInterfaces.online.size) {
      const found = await this.fetchIpset('ws', 'fetch');
      if (!found) {
        this.wsInterfaces.online = new Set<string>([...this.wsInterfaces.online, ...this.wsInterfaces.offline]);
        this.wsInterfaces.offline.clear();
      }
    }

    return null;
  }
  static async disconnectSocket(): Promise<boolean> {
    for (let id in this.requests.pending) {
      const response = this.requests.pending.get(id);
      if (response != null)
        response.resolve(new Error('connection reset'));
    }

    this.requests.pending.clear();
    if (!this.socket)
      return true;
    else if (this.onNodeResponse)
      this.onNodeResponse(this.socket.url, 'disconnect', null, 0);
 
    this.socket.onopen = null;
    this.socket.onerror = null;
    this.socket.onmessage = null;
    this.socket.onclose = null;
    this.socket.close();
    this.socket = null;
    return true;
  }
  static saveProps(props: InterfaceProps): void {
    Storage.set(StorageField.InterfaceProps, props);
    this.props.data = props;
    this.props.preload = true;
  }
  static getProps(): InterfaceProps {
    if (this.props.preload)
      return this.props.data;

    const props = Storage.get(StorageField.InterfaceProps);
    if (props != null)
      this.props.data = props;
    
    this.props.preload = true;
    return this.props.data;
  }
  static clearCache(): void {
    const keys = Storage.keys();
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key.startsWith(CACHE_PREFIX + ':'))
        Storage.set(key);
    }
  }
  static submitTransaction(hexMessage: string, validate: boolean): Promise<string | null> {
    return this.fetch('no-cache', 'submittransaction', [hexMessage, validate]);
  }
  static getBlockchains(): Promise<any[] | null> {
    return this.fetch('cache', 'getblockchains', []);
  }
  static getBestAccountContributionsWithRewards(asset: AssetId, offset: number, count: number): Promise<any[] | null> {
    return this.fetch('no-cache', 'getbestaccountcontributionswithrewards', [asset.handle, offset, count]);
  }
  static getNextAccountSequence(address: string): Promise<{ min: BigNumber | string, max: BigNumber | string } | null> {
    return this.fetch('no-cache', 'getnextaccountsequence', [address]);
  }
  static getAccountBalance(address: string, asset: AssetId): Promise<{ supply: BigNumber, reserve: BigNumber, balance: BigNumber } | null> {
    return this.fetch('no-cache', 'getaccountbalance', [address, asset.handle]);
  }
  static getAccountBalances(address: string, offset: number, count: number): Promise<any[] | null> {
    return this.fetch('no-cache', 'getaccountbalances', [address, offset, count]);
  }
  static getWitnessAddresses(address: string, offset: number, count: number): Promise<any[] | null> {
    return this.fetch('no-cache', 'getwitnessaddresses', [address, offset, count]);
  }
  static getWitnessAddressesByPurpose(address: string, purpose: 'witness' | 'router' | 'custodian' | 'contribution', offset: number, count: number): Promise<any[] | null> {
    return this.fetch('no-cache', 'getwitnessaddressesbypurpose', [address, purpose, offset, count]);
  }
  static getMempoolTransactionsByOwner(address: string, offset: number, count: number, direction?: number, unrolling?: number): Promise<any[] | null> {
    const args = [address, offset, count];
    if (direction != null)
      args.push(direction);
    if (unrolling != null)
      args.push(unrolling);
    return this.fetch('no-cache', 'getmempooltransactionsbyowner', args);
  }
  static getTransactionsByOwner(address: string, offset: number, count: number, direction?: number, unrolling?: number): Promise<any[] | null> {const args = [address, offset, count];
    if (direction != null)
      args.push(direction);
    if (unrolling != null)
      args.push(unrolling);
    return this.fetch('no-cache', 'gettransactionsbyowner', args);
  }
  static getTransactionByHash(hash: string, unrolling?: number): Promise<any | null> {
    return this.fetch('cache', 'gettransactionbyhash', unrolling != null ? [hash, unrolling] : [hash]);
  }
  static getMempoolTransactionByHash(hash: string): Promise<any | null> {
    return this.fetch('cache', 'getmempooltransactionbyhash', [hash]);
  }
  static getMempoolCumulativeConsensus(hash: string): Promise<{ branch: string, threshold: BigNumber, progress: BigNumber, committee: BigNumber, reached: boolean } | null> {
    return this.fetch('no-cache', 'getcumulativemempoolconsensus', [hash]);
  }
  static getBlockByNumber(number: number, unrolling?: number): Promise<any | null> {
    return this.fetch('cache', 'getblockbynumber', unrolling != null ? [number, unrolling] : [number]);
  }
  static getBlockByHash(hash: string, unrolling?: number): Promise<any | null> {
    return this.fetch('cache', 'getblockbyhash', unrolling != null ? [hash, unrolling] : [hash]);
  }
  static getBlockTipNumber(): Promise<BigNumber | string | null> {
    return this.fetch('no-cache', 'getblocktipnumber', []);
  }
  static getGasPrice(asset: AssetId, percentile?: number): Promise<any | null> {
    return this.fetch('no-cache', 'getgasprice', percentile != null ? [asset.handle, percentile] : [asset.handle]);
  }
  static getOptimalTransactionGas(hexMessage: string): Promise<BigNumber | string | null> {
    return this.fetch('no-cache', 'getoptimaltransactiongas', [hexMessage]);
  }
  static getEstimateTransactionGas(hexMessage: string): Promise<BigNumber | string | null> {
    return this.fetch('no-cache', 'getestimatetransactiongas', [hexMessage]);
  }
}

export class InterfaceUtil {
  static calculateSummaryState(events?: { event: BigNumber, args: any[] }[]): SummaryState {
    const result: SummaryState = {
      witnesses: {
        addresses: { },
        transactions: { }
      },
      contributions: { },
      balances: { },
      errors: []
    };
    if (!events || !Array.isArray(events))
      return result;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      switch (event.event.toNumber()) {
        case 0: {
          if (event.args.length >= 1 && typeof event.args[0] == 'string') {
            result.errors.push(event.args[0]);
          }
          break;
        }
        case States.AccountBalance.type: {
          if (event.args.length >= 4 && (event.args[0] instanceof BigNumber || typeof event.args[0] == 'string') && typeof event.args[1] == 'string' && typeof event.args[2] == 'string' && event.args[3] instanceof BigNumber) {
            const [assetId, from, to, value] = event.args;
            const fromAddress = Signing.encodeAddress(new Pubkeyhash(from)) || from;
            const toAddress = Signing.encodeAddress(new Pubkeyhash(to)) || to;
            const asset = new AssetId(assetId);
            if (!asset.handle)
              break;

            if (!result.balances[fromAddress])
              result.balances[fromAddress] = { };
            if (!result.balances[fromAddress][asset.handle])
              result.balances[fromAddress][asset.handle] = { asset: asset, supply: new BigNumber(0), reserve: new BigNumber(0), balance: new BigNumber(0) };
            if (!result.balances[toAddress])
              result.balances[toAddress] = { };
            if (!result.balances[toAddress][asset.handle])
              result.balances[toAddress][asset.handle] = { asset: asset, supply: new BigNumber(0), reserve: new BigNumber(0), balance: new BigNumber(0) };

            const fromState = result.balances[fromAddress][asset.handle];
            fromState.supply = fromState.supply.minus(value);
            fromState.balance = fromState.balance.minus(value);
            
            const toState = result.balances[toAddress][asset.handle];
            toState.supply = toState.supply.plus(value);
            toState.balance = toState.balance.plus(value);
          } else if (event.args.length >= 4 && (event.args[0] instanceof BigNumber || typeof event.args[0] == 'string') && typeof event.args[1] == 'string' && event.args[2] instanceof BigNumber && event.args[3] instanceof BigNumber) {
            const [assetId, owner, supply, reserve] = event.args;
            const ownerAddress = Signing.encodeAddress(new Pubkeyhash(owner)) || owner;
            const asset = new AssetId(assetId);
            if (!asset.handle)
              break;
            
            if (!result.balances[ownerAddress])
              result.balances[ownerAddress] = { };
            if (!result.balances[ownerAddress][asset.handle])
              result.balances[ownerAddress][asset.handle] = { asset: asset, supply: new BigNumber(0), reserve: new BigNumber(0), balance: new BigNumber(0) };

            const ownerState = result.balances[ownerAddress][asset.handle];
            ownerState.supply = ownerState.supply.plus(supply)
            ownerState.reserve = ownerState.reserve.plus(reserve);
            ownerState.balance = ownerState.balance.plus(supply.minus(reserve));
          }
          break;
        }
        case States.AccountContribution.type: {
          if (event.args.length >= 4 && (event.args[0] instanceof BigNumber || typeof event.args[0] == 'string') && typeof event.args[1] == 'string' && event.args[2] instanceof BigNumber && event.args[3] instanceof BigNumber) {
            const [assetId, owner, custody, coverage] = event.args;
            const ownerAddress = Signing.encodeAddress(new Pubkeyhash(owner)) || owner;
            const asset = new AssetId(assetId);
            if (!asset.handle)
              break;
            
            if (!result.contributions[ownerAddress])
              result.contributions[ownerAddress] = { };
            if (!result.contributions[ownerAddress][asset.handle])
              result.contributions[ownerAddress][asset.handle] = { asset: asset, custody: new BigNumber(0), coverage: new BigNumber(0) };

            const ownerState = result.contributions[ownerAddress][asset.handle];
            ownerState.custody = ownerState.custody.plus(custody);
            ownerState.coverage = ownerState.coverage.plus(coverage);
          }
          break;
        }
        case States.WitnessAddress.type: {
          if (event.args.length >= 2 && (event.args[0] instanceof BigNumber || typeof event.args[0] == 'string') && event.args[1] instanceof BigNumber) {
            const [assetId, addressIndex, addressAliases] = [event.args[0], event.args[1], event.args.slice(2)];
            const asset = new AssetId(assetId);
            if (!asset.handle)
              break;
            
            if (!result.witnesses.addresses[asset.handle])
              result.witnesses.addresses[asset.handle] = { asset: asset, index: new BigNumber(0), aliases: [] };

            const addressState = result.witnesses.addresses[asset.handle];
            addressState.index = addressIndex;
            for (let i = 0; i < addressAliases.length; i++) {
              if (typeof addressAliases[i] == 'string')
                addressState.aliases.push(addressAliases[i]);
            }
          }
          break;
        }
        case States.WitnessTransaction.type: {
          if (event.args.length == 2 && (event.args[0] instanceof BigNumber || typeof event.args[0] == 'string') && typeof event.args[1] == 'string') {
            const [assetId, transactionId] = event.args;
            const asset = new AssetId(assetId);
            if (!asset.handle)
              break;
            
            if (result.witnesses.transactions[asset.handle] != null)
              result.witnesses.transactions[asset.handle].push({ asset: asset, transactionId: transactionId });
            else
              result.witnesses.transactions[asset.handle] = [{ asset: asset, transactionId: transactionId }];
          }
          break;
        }
        default:
          break;
      }
    }

    return result;
  }
  static calculateAssetRecords(data: any[]): Record<string, any[]> {
    const result: Record<string, any[]> = { };
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const assetId = item.asset != null && (item.asset.id instanceof BigNumber || typeof item.asset.id == 'string') ? item.asset.id : null;
      const assetHandle = assetId != null ? new AssetId(assetId).handle || '' : '';
      if (!result[assetHandle])
        result[assetHandle] = [item];
      else
        result[assetHandle].push(item);
    }
    return result;
  }
}