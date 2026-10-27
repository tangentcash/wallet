import { AssetId, ByteUtil, Hashing } from "tangentsdk/algorithm";
import { UiUtil } from "tangentsdk/ui";
import { PreflightCallback, RPC } from "tangentsdk/rpc";
import { Stream, Viewable } from "tangentsdk/serialization";
import { Whitelist } from "tangentsdk/whitelist";
import { AppStorage } from "./storage"
import { AppData } from "./app"
import BigNumber from "bignumber.js"
import Currencies from './../configs/currencies.json'

const WEBSOCKET_TIMEOUT = 24000;

export enum MarketPolicy {
    Spot,
    Margin
}

export enum OrderCondition {
    Market,
    Limit,
    Stop,
    StopLimit,
    TrailingStop,
    TrailingStopLimit
}

export enum OrderSide {
    Buy,
    Sell
}

export enum OrderPolicy {
    Deferred,
    DeferredAll,
    Immediate,
    ImmediateAll
}

export type Balance = {
  asset: AssetId,
  poly: boolean,
  unavailable: BigNumber,
  available: BigNumber,
  price: BigNumber | null
}

export type PolyAsset = (AssetId & { liquidity?: BigNumber });

export type Order = {
    id: BigNumber;
    orderId: BigNumber;
    pairId: BigNumber;
    primaryAsset: AssetId;
    secondaryAsset: AssetId;
    accountId: BigNumber;
    blockNumber: BigNumber;
    condition: OrderCondition;
    side: OrderSide;
    policy: OrderPolicy;
    price?: BigNumber;
    stopPrice?: BigNumber;
    fillingPrice?: BigNumber;
    startingValue: BigNumber;
    value: BigNumber;
    slippage?: BigNumber;
    trailingStep?: BigNumber;
    trailingDistance?: BigNumber;
    lastPrice?: BigNumber;
    lastQuantity?: BigNumber;
    active: boolean
}

export type Pool = {
    id: BigNumber;
    poolId: BigNumber;
    pairId: BigNumber;
    primaryAsset: AssetId;
    secondaryAsset: AssetId;
    accountId: BigNumber;
    blockNumber: BigNumber;
    initialPrice: BigNumber;
    initialPrimaryValue: BigNumber;
    initialSecondaryValue: BigNumber;
    primaryValue: BigNumber;
    secondaryValue: BigNumber;
    primaryRevenue: BigNumber;
    secondaryRevenue: BigNumber;
    liquidity: BigNumber;
    price: BigNumber;
    minPrice?: BigNumber;
    maxPrice?: BigNumber;
    feeRate: BigNumber;
    exitFee: BigNumber;
    volume: BigNumber;
    lastAskPrice: BigNumber;
    lastBidPrice: BigNumber;
    active: boolean;
}

export type DelegatedPool = {
    id: BigNumber;
    pairId: BigNumber;
    delegatorAccount: string;
    accountId: BigNumber;
    primaryAsset: AssetId;
    secondaryAsset: AssetId;
    blockNumber: BigNumber;
    rewardValue: BigNumber;
    initialPrimaryValue: BigNumber;
    initialSecondaryValue: BigNumber;
    primaryValue: BigNumber;
    secondaryValue: BigNumber;
    allocationPrice?: BigNumber;
    primaryTotal?: BigNumber;
    secondaryTotal?: BigNumber;
    primaryReserve?: BigNumber;
    secondaryReserve?: BigNumber;
    volume?: BigNumber;
    feeRate?: BigNumber;
    share?: BigNumber;
    active: boolean;
}

export type PageQuery = {
  page?: number;
}

export type AccountQuery = {
  id?: string | number | BigNumber,
  address?: string
}

export enum ContractType {
  DEX = 'dex',
  DLP = 'dlp',
  UAP = 'uap',
  AMS = 'ams'
}

export type Contract = {
  id: BigNumber;
  type: string;
  accountId: BigNumber;
  account: string;
  deployerAccountId: BigNumber;
  deployerAccount: string;
  blockNumber: BigNumber;
  parameters: any;
}

export type Booking = {
  id: string;
  asset: string | { id: string };
  amount: string;
  publicKey: string;
  status: string;
  expiresBlock: string | number;
  txHash: string;
  depositHash: string | null;
  depositStatus: string | null;
  depositBlock: string | number | null;
  depositPayer: string | null;
  withdrawHash: string | null;
  outAsset: string | null;
  outAmount: string | null;
  broadcastHash: string | null;
  proofTransactionId: string | null;
  relayError: string | null;
  attestateHash: string | null;
  routingAddress: string | null;
}

export type SwapLeg = {
  symbol: string,
  asset: string,
  price: string,
  amount: string,
  expected?: string,
  slippage: string,
  buying: boolean
}

export type SwapPreview = {
  successful: boolean,
  outAmount: string | null,
  error: string | null
}

export type PseudoDelegatedPool = {
    pairId: BigNumber;
    delegatorAccount: string;
    primaryAsset: AssetId;
    secondaryAsset: AssetId;
    initialValue: BigNumber;
    currentValue: BigNumber;
    volume: BigNumber;
    feeRate?: BigNumber;
}

export type AggregatedPair = {
  id: BigNumber,
  primaryAsset: AssetId,
  secondaryAsset: AssetId,
  secondaryBase: string | null,
  launchTime: number,
  poolFeeRate: BigNumber | null,
  price: {
      orderLiquidity: BigNumber | null,
      poolLiquidity: BigNumber | null,
      totalLiquidity: BigNumber | null,
      orderVolume: BigNumber | null,
      poolVolume: BigNumber | null,
      totalVolume: BigNumber | null,
      open: BigNumber | null,
      low: BigNumber | null,
      high: BigNumber | null,
      close: BigNumber | null
  }
}

export type AggregatedLog = {
  time: Date,
  account: string,
  side: OrderSide | 'lp',
  price: BigNumber,
  quantity: BigNumber
}

export type AggregatedLevel = {
  id: number,
  price: BigNumber,
  quantity: BigNumber,
  curve?: {
      minPrice: BigNumber | null,
      maxPrice: BigNumber | null,
      primaryValue: BigNumber,
      secondaryValue: BigNumber,
      feeRate: BigNumber
  }
}

export type AccountTier = {
  primary: {
    volume: BigNumber | null,
    makerFee: BigNumber | null,
    takerFee: BigNumber | null
  },
  secondary: {
    volume: BigNumber | null,
    makerFee: BigNumber | null,
    takerFee: BigNumber | null
  }
}

export type BlockchainInfo = AssetId & {
    divisibility: BigNumber,
    syncLatency: BigNumber,
    compositionPolicy: string,
    tokenPolicy: string,
    routingPolicy: string,
    slowTransfer: boolean
    bulkTransfer: boolean
}

export type RouterPath = {
    pair: {
        id: BigNumber,
        primaryAsset: { id: BigNumber, hash: AssetId } | null,
        secondaryAsset: { id: BigNumber, hash: AssetId } | null
    },
    side: OrderSide,
    input: { min: BigNumber, max: BigNumber },
    output: { min: BigNumber, max: BigNumber }
}[];

export type PriceDescriptors = Record<string, { whitelist: boolean, base: string | null, price: { open: BigNumber | null, close: BigNumber | null } }>;

export type PromiseCallback = (data: any) => void;

export class Cursor {
    offset: number = 0;
    count: number = 0;

    static offset(offset: number, count: number = 32): Cursor {
        const result = new Cursor();
        result.offset = offset;
        result.count = count;
        return result;
    }
    static page(number: number, count: number = 32): Cursor {
        const result = new Cursor();
        result.count = count;
        result.offset = result.count * number;
        return result;
    }
}

export enum ExchangeField {
  Orderbook = '__orderbook__',
  OrderbookData = '__orderbook_data__',
  OrderbookMaker = '__orderbook_maker:path__',
  OrderbookTab = '__orderbook_tab__',
  PortfolioView = '__portfolio_view__',
  PortfolioRouter = '__portfolio_router__',
  PortfolioMarket = '__portfolio_market__',
  PortfolioMockPairs = '__mock_pairs__',
  AssetsHistory = '__assets_history__',
  EquityAsset = '__equity_asset__'
}

export class Exchange {
  private static synchronizing: Promise<void> | null = null;
  static prices: PriceDescriptors = { };
  static contracts: Contract[] = [];
  static descriptors: BlockchainInfo[] = [];
  static equityAsset: AssetId = AssetId.fromHandle('USD');
  static equityRate: BigNumber = new BigNumber(1);
  static orderbook:  string | null = null;
  static socket: WebSocket | null = null;
  static ready: boolean = false;
  static quiet: boolean = false;
  static channelId: string | null = null;
  static awaitables: (() => void)[] = [];
  static requests = {
    pending: new Map<string, { resolve: PromiseCallback } >(),
    count: 0
  };

  static storeURL(params: URLSearchParams, key: string, value: any, parentPrefix = '') {
    const fullKey = parentPrefix ? `${parentPrefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          Object.keys(item).forEach(subKey => params.append(`${fullKey}[${index}][${subKey}]`, item[subKey]));
        } else {
          params.append(fullKey, item);
        }
      });
    } else if (typeof value === 'object') {
      Object.keys(value).forEach(subKey => {
          this.storeURL(params, subKey, value[subKey], fullKey);
      });
    } else if (value != null) {
      params.append(fullKey, value);
    }
  }
  static fetchResult(hash: string, data: any): any[] | undefined {    
    if (!data || Array.isArray(data) || data.result === undefined) {
      return undefined;
    } else if (RPC.onCacheStore != null && hash != null && data.error == null) {
      RPC.onCacheStore(hash, data.result);
    }
    
    if (!data.error) {
      return RPC.fetchObject(data.result)
    }

    throw new Error(`${data.error} — E${ByteUtil.uint8ArrayToHexString(Hashing.hash160(ByteUtil.byteStringToUint8Array(data.error))).substring(0, 8).toUpperCase()}`);
  }
  static priceOf(primaryAsset: AssetId, secondaryAsset?: AssetId): { open: BigNumber | null, close: BigNumber | null } {
    const primarySymbol = primaryAsset.token || primaryAsset.chain || null;
    const primaryTarget = primarySymbol && !Whitelist.fake(primaryAsset) ? this.prices[primarySymbol] : null;
    if (secondaryAsset != null) {
      const secondarySymbol = secondaryAsset.token || secondaryAsset.chain || null;
      const secondaryTarget = secondarySymbol && !Whitelist.fake(secondaryAsset) ? this.prices[secondarySymbol] : null;
      return {
        open: primaryTarget && primaryTarget.price.open && secondaryTarget && secondaryTarget.price.open ? primaryTarget.price.open.dividedBy(secondaryTarget.price.open) : null,
        close: primaryTarget && primaryTarget.price.close && secondaryTarget && secondaryTarget.price.close ? primaryTarget.price.close.dividedBy(secondaryTarget.price.close) : null
      };
    } else {
      return primaryTarget ? primaryTarget.price : { open: null, close: null };
    }
  }
  static toOrderbookQuery(primaryAsset: AssetId, secondaryAsset: AssetId): string {
    const query = new Stream();
    query.writeInteger(primaryAsset.toUint256());
    query.writeInteger(secondaryAsset.toUint256());
    return query.encode();
  }
  static fromOrderbookQuery(orderbookQuery: string): { primaryAsset: AssetId | null, secondaryAsset: AssetId | null } {
    const query = Stream.decode(orderbookQuery);
    const primaryAsset = query.readInteger(query.readType() || Viewable.Invalid);
    const secondaryAsset = query.readInteger(query.readType() || Viewable.Invalid);
    return {
      primaryAsset: primaryAsset ? new AssetId(primaryAsset.toHex()) : null,
      secondaryAsset: secondaryAsset ? new AssetId(secondaryAsset.toHex()) : null
    }
  }
  static dispatchEvent(type: string, notification: any) {
    if (type == 'update:trade' && notification != null && notification.data != null && notification.data.secondaryBase == (this.equityAsset.token || this.equityAsset.chain)) {
      try {
        const asset = new AssetId(notification.data.primaryAsset.id);
        const price = new BigNumber(notification.data.price);
        const symbol = asset.token || asset.chain || '';
        const whitelist = !!Whitelist.contractAddressOf(asset);
        const prev = this.prices[symbol];
        if (!prev || prev.whitelist == whitelist || (!prev.whitelist && whitelist)) {
          this.prices[symbol] = { whitelist: whitelist, base: prev?.base || this.equityAsset.chain, price: { open: prev?.price?.open || price, close: price } };
        }
      } catch { }
    }
    window.dispatchEvent(new CustomEvent(type, {
      detail: notification.data
    }));
  }
  static setEquityAsset(asset: AssetId): boolean {
    if (this.equityAsset.id != asset.id && asset.chain && !asset.token && !asset.checksum && Currencies.find(x => x[0] == asset.chain)) {
      this.ready = false;
      this.equityAsset = asset;
      AppStorage.set(ExchangeField.EquityAsset, this.equityAsset.chain);
      return true;
    }
    return false;
  }
  static setOrderbook(orderbook: string): void {
    const target = this.fromOrderbookQuery(orderbook);
    const value = target.primaryAsset && target.secondaryAsset ? orderbook : null;
    if (value != this.orderbook)
      AppStorage.set(ExchangeField.Orderbook, this.orderbook = value);
  }
  static getOrderbook(): string | null {
    return this.orderbook;
  }
  static getEquityAssets(): string[][] {
    return Currencies;
  }
  static establish(): Promise<void> {
    return new Promise<void>(async (resolve) => {
      if (!this.socket || !this.ready) {
        this.awaitables.push(resolve);
        if (this.awaitables.length == 1) {
          const address = AppData.getWalletAddress();
          await this.channel(address ? [address] : []);
          await this.synchronize();
        }
      } else {
        resolve();
      }
    });
  }
  static dexContract(): Contract | null {
    return this.contracts.find((v) => v.type == ContractType.DEX) || null;
  }
  static dlpContract(): Contract | null {
    return this.contracts.find((v) => v.type == ContractType.DLP) || null;
  }
  static uapContract(): Contract | null {
    return this.contracts.find((v) => v.type == ContractType.UAP) || null;
  }
  static amsContract(): Contract | null {
    return this.contracts.find((v) => v.type == ContractType.AMS) || null;
  }
  static async synchronize(): Promise<void> {
    if (this.synchronizing != null)
      return;

    let release: () => void;
    this.synchronizing = new Promise<void>((resolve) => { release = resolve; });
    try {
      if (!this.ready) {
        const equityAsset = AppStorage.get(ExchangeField.EquityAsset);
        if (typeof equityAsset == 'string' && equityAsset.length > 0) {
          this.setEquityAsset(AssetId.fromHandle(equityAsset));
        }

        try {
          const portfolio = await this.assets(this.equityAsset.chain || undefined);
          this.prices = portfolio?.prices || { };
          this.contracts = portfolio?.contracts || [];
          this.descriptors = (portfolio?.descriptors || []).sort((a, b) => UiUtil.toAssetSymbol(a).localeCompare(UiUtil.toAssetSymbol(b)));
          this.equityRate = portfolio?.rate || new BigNumber(0);
          if (!this.equityAsset) {
            const base = this.prices['__BASE__']?.base || null;
            this.equityAsset = base ? AssetId.fromHandle(base) : this.equityAsset;
          }
        } catch { }

        this.ready = true;
        this.orderbook = AppStorage.get(ExchangeField.Orderbook);
        this.dispatchEvent('exchange:ready', { data: { } });
      }
    } finally {
      const done = release!;
      this.synchronizing = null;
      done();
    }

    if (this.awaitables != null) {
      for (let i = 0; i < this.awaitables.length; i++) {
        this.awaitables[i]();
      }
      this.awaitables = [];
    }
  }
  static async fetch(policy: 'cache' | 'no-cache' | 'cache-direct' | 'no-cache-direct', method: 'GET' | 'POST' | 'DELETE', location: string, args: Record<string, any>, preflightCache?: PreflightCallback, quiet?: boolean) {
    const hash = ByteUtil.uint8ArrayToHexString(Hashing.hash512(ByteUtil.utf8StringToUint8Array(JSON.stringify([method, location, args || []]))));
    try {
      if (RPC.onCacheLoad != null && (policy == 'cache' || policy == 'cache-direct' || preflightCache)) {
        let cache = RPC.onCacheLoad(hash);
        cache = (cache instanceof Promise ? await cache : cache);
        if (cache != null) {
          const cachedValue = RPC.fetchObject(cache);
          if (preflightCache)
            preflightCache(cachedValue);
          if (policy == 'cache' || policy == 'cache-direct')
            return cachedValue;
        }
      }

      if (policy == 'cache' || policy == 'no-cache') {
        await this.establish();
      }
      
      if (this.socket) {
        const id = (++this.requests.count).toString();
        const content = JSON.stringify({
          id: id,
          method: method.toLowerCase() + '://' + location,
          params: args
        });
        const data: any | Error = await new Promise((resolve, reject) => {
          const context = { resolve: (_: any) => { } };
          const timeout = setTimeout(() => context.resolve(new Error('connection timed out')), WEBSOCKET_TIMEOUT);
          context.resolve = (data: any | Error) => {
            this.requests.pending.delete(id);
            clearTimeout(timeout);
            if (data instanceof Error)
              reject(data);
            else
              resolve(data);
          };
          this.requests.pending.set(id, context);
          if (this.socket != null) {
            this.socket.send(content);
          } else {
            context.resolve(new Error('connection reset'));
          }
        });
        const result = this.fetchResult(hash, data instanceof Error ? { error: data.toString() } : data);
        if (RPC.onNodeMessage && !this.quiet)
          RPC.onNodeMessage(location, { args: args, result: result }, content.length + JSON.stringify(data).length);
        return result;
      } else {
        const body = method != 'GET';
        const search = new URLSearchParams();
        if (!body && args != null && typeof args == 'object')
          Object.keys(args).forEach(key => this.storeURL(search, key, args[key]));
        await this.synchronize();

        const url = new URL(`${this.getURL()}/${location}${search.size > 0 ? '?' : ''}${search.toString()}`);
        const response = await fetch(url, {
          method: method,
          headers: body && args != null ? { 'Content-Type': 'application/json' } : undefined,
          body: body && args != null ? JSON.stringify(args) : undefined,
        });
        const text = await response.text();
        const data = JSON.parse(text);
        const result = this.fetchResult(hash, data);
        if (RPC.onNodeMessage && !this.quiet)
          RPC.onNodeMessage(location, { args: args, result: result }, text.length);
        return result;
      }
    } catch (exception) {
      if (RPC.onNodeMessage && !this.quiet && quiet !== true)
        RPC.onNodeMessage(location, { args: [], error: exception }, 0);
      if (!(exception instanceof Error) && RPC.onCacheLoad != null) {
        let cache = RPC.onCacheLoad(hash);
        cache = (cache instanceof Promise ? await cache : cache);
        if (cache != null)
          return RPC.fetchObject(cache);
      }
      throw exception;
    }
  }
  static async channel(addresses: string[] | null): Promise<boolean> {
    if (addresses == null) {
      if (this.socket != null) {
          this.socket.onmessage = null;
        this.socket.onclose = null;
        this.socket.close();
        this.socket = null;
      }
      return true;
    }

    if (!this.socket) {
      try {
        this.socket = await new Promise<WebSocket>((resolve, reject) => {
          const socket = new WebSocket(`${this.getURL()}/`);
          socket.onopen = () => resolve(socket);
          socket.onerror = () => reject(new Error('websocket connection error'));
        });
        if (RPC.onNodeMessage && !this.quiet)
          RPC.onNodeMessage('erelay', { args: null, result: null }, 0);
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
                if (data.notification != null && typeof data.notification.type == 'string')
                  this.dispatchEvent(data.notification.type, data.notification);
              } else if (typeof data.result != 'undefined' && data.id != null) {
                if (data.id != 'connect') {
                  const response = this.requests.pending.get(data.id.toString());
                  if (response != null)
                    response.resolve(data);
                } else {
                  this.channelId = data.id;
                }
              }
            }
          } catch { }
        };
        this.socket.onclose = () => {
          if (this.socket != null) {
            this.socket.onopen = null;
            this.socket.onerror = null;
            this.socket.onmessage = null;
            this.socket.onclose = null;
            this.socket.close();
            this.socket = null;
          }
          this.channel(addresses);
        };
      } catch {
        return false;
      }
    }

    if (this.socket != null) {
      this.socket.send(JSON.stringify({
        method: 'post://',
        params: {
          accounts: addresses
        },
        id: "connect"
      }));
    }

    return true;
  }
  static async assets(base?: string): Promise<{ prices: PriceDescriptors, descriptors: BlockchainInfo[], contracts: Contract[], rate: BigNumber | null } | null> {
    const result = await this.fetch('no-cache-direct', 'GET', `assets`, { base: base });
    if (!result)
      return null;

    if (Array.isArray(result.contracts))
      result.contracts = result.contracts.map((x: any) => this.toContract(x));

    return result;
  }
  static async assetQuery(query: string): Promise<AssetId[]> {
    const result = await this.fetch('no-cache', 'GET', `asset/query`, { query: query.trim() });
    return result.map((item: any) => new AssetId(item.id));
  }
  static async assetPrices(): Promise<PriceDescriptors> {
    const result = await this.fetch('no-cache', 'GET', `asset/prices`, { });
    return result;
  }
  static async assetDescriptors(): Promise<BlockchainInfo[]> {
    const result = await this.fetch('cache', 'GET', `asset/descriptors`, { });
    return result;
  }
  static async marketOrder(orderId: number | string | BigNumber): Promise<Order> {
    const result = await this.fetch('no-cache', 'GET', `market/order`, { id: orderId.toString() });
    return this.toOrder(result);
  }
  static async marketPool(poolId: number | string | BigNumber): Promise<Pool> {
    const result = await this.fetch('no-cache', 'GET', `market/pool`, { id: poolId.toString() });
    return this.toPool(result);
  }
  static async marketPools(account: PageQuery): Promise<Pool[]> {
    const result = await this.fetch('no-cache', 'GET', `market/pools`, {
      page: account.page
    });
    return result.map((v: any) => this.toPool(v));
  }
  static async marketDelegatedPool(poolId: number | string | BigNumber): Promise<DelegatedPool> {
    const result = await this.fetch('no-cache', 'GET', `market/pool/delegated`, { id: poolId.toString() });
    return this.toDelegatedPool(result);
  }
  static async marketDelegatedPools(): Promise<PseudoDelegatedPool[]> {
    const result = await this.fetch('no-cache', 'GET', `market/pools/delegated`, { });
    return result.map((v: any): PseudoDelegatedPool => ({
      pairId: new BigNumber(v.pairId),
      delegatorAccount: v.delegatorAccount,
      primaryAsset: new AssetId(v.primaryAsset),
      secondaryAsset: new AssetId(v.secondaryAsset),
      initialValue: new BigNumber(v.initialValue),
      currentValue: new BigNumber(v.currentValue),
      volume: new BigNumber(v.volume),
      feeRate: v.feeRate ? new BigNumber(v.feeRate) : undefined
    }));
  }
  static async marketAssets(asset: AssetId, liquidity?: boolean): Promise<PolyAsset[]> {
    const result = await this.fetch('no-cache', 'GET', `market/assets`, {
      assetHash: asset.id.toString(),
      liquidity: typeof liquidity == 'boolean' ? liquidity : undefined
    });
    return result.map((item: any) => {
      const updated: PolyAsset = new AssetId(item.id);
      if (item.liquidity)
        updated.liquidity = item.liquidity;
      return updated;
    });
  }
  static async marketPriceHistory(assets: AssetId[], interval: number, points: number): Promise<Record<string, AssetId & { history: [number, BigNumber][] }>> {
    const result = await this.fetch('no-cache', 'GET', `market/price/history`, {
      assetHashes: assets.map(v => v.id).join(','),
      interval: interval,
      points: points
    });
    const keys = Object.keys(result);
    for (let i = 0; i < keys.length; i++) {
      const item = result[keys[i]];
      const pseudoAsset: AssetId & { history: [number, BigNumber][] } = new AssetId(item.id) as any;
      pseudoAsset.history = item.history;
      result[keys[i]] = pseudoAsset;
    }
    return result;
  }
  static async marketPaths(assetIn: AssetId, assetOut: AssetId, amountIn: number | string | BigNumber, slippage: number | string | BigNumber): Promise<RouterPath[]> {
    const result = await this.fetch('no-cache', 'GET', `market/paths`, { assetHashIn: assetIn.id.toString(), assetHashOut: assetOut.id.toString(), amountIn: amountIn.toString(), slippage: slippage.toString() });
    for (let i = 0; i < result.length; i++) {
      const path = result[i];
      for (let j = 0; j < path.length; j++) {
        const item = path[j];
        item.pair.primaryAsset.hash = new AssetId(item.pair.primaryAsset.hash.id);
        item.pair.secondaryAsset.hash = new AssetId(item.pair.secondaryAsset.hash.id);
        item.side = new BigNumber(item.side).toNumber();
      }
    }
    return result;
  }
  static async marketPathsDirect(assetHashIn: string, assetHashOut: string, amountIn: string, slippage: string): Promise<any[]> {
    try {
      return (await this.fetch('no-cache', 'GET', 'market/paths', { assetHashIn, assetHashOut, amountIn, slippage })) || [ ];
    } catch {
      return [ ];
    }
  }
  static async marketPairs(preflightCache?: PreflightCallback): Promise<AggregatedPair[]> {
    const process = (data: any) => {
      for (let key in data) {
        const item = data[key];
        item.primaryAsset = new AssetId(item.primaryAsset);
        item.secondaryAsset = new AssetId(item.secondaryAsset);
      }
      return data;
    };
    const result = await this.fetch('no-cache', 'GET', `market/pairs`, { }, preflightCache ? (cache) => preflightCache(process(cache)) : undefined);
    return process(result);
  }
  static async marketPair(primaryAsset: AssetId, secondaryAsset: AssetId, createIfNotExists: boolean): Promise<AggregatedPair> {
    const result = await this.fetch('no-cache', 'GET', `market/pair`, { primaryAssetHash: primaryAsset.id.toString(), secondaryAssetHash: secondaryAsset.id.toString(), createIfNotExists: createIfNotExists }, undefined);
    result.primaryAsset = new AssetId(result.primaryAsset);
    result.secondaryAsset = new AssetId(result.secondaryAsset);
    return result;
  }
  static async marketPairPriceSeries(pairId: number | string | BigNumber, interval: string | number | BigNumber, page: string | number | BigNumber): Promise<{ time: number, volume: BigNumber, open: BigNumber, low: BigNumber, high: BigNumber, close: BigNumber }[]> {
    const result = await this.fetch('no-cache', 'GET', `market/pair/price/series`, { pairId: pairId.toString(), interval: interval.toString(), page: page.toString() });
    return result.map((v: any[]) => ({
      time: v[0].toNumber(),
      volume: v[1],
      open: v[2],
      low: v[3],
      high: v[4],
      close: v[5]
    }));
  }
  static async marketPairPriceLevels(pairId: number | string | BigNumber, levels: number): Promise<{ ask: AggregatedLevel[], bid: AggregatedLevel[] }> {
    const toAggregatedLevel = (v: any[]): AggregatedLevel => {
      return {
        id: v[0].toNumber(),
        price: v[1],
        quantity: v[2],
        curve: v.length == 8 ? {
          minPrice: v[3],
          maxPrice: v[4],
          primaryValue: v[5],
          secondaryValue: v[6],
          feeRate: v[7]
        } : undefined
      };
    };
    const result = await this.fetch('no-cache', 'GET', `market/pair/price/levels`, { pairId: pairId.toString(), levels: levels });
    return {
      ask: result.ask.map(toAggregatedLevel),
      bid: result.bid.map(toAggregatedLevel)
    };
  }
  static async marketPairAssets(pairId: number | string | BigNumber): Promise<{ primary: AssetId[], secondary: AssetId[] }> {
    const result = await this.fetch('no-cache', 'GET', `market/pair/assets`, {
      pairId: pairId?.toString()
    });
    return {
      primary: result.primary.map((item: any) => new AssetId(item.id)),
      secondary: result.secondary.map((item: any) => new AssetId(item.id)),
    };
  }
  static async marketPairLogs(account: { pairId?: number | string | BigNumber } & PageQuery): Promise<AggregatedLog[]> {
    const result = await this.fetch('no-cache', 'GET', `market/pair/logs`, {
      pairId: account.pairId?.toString(),
      page: account.page
    });
    return result.map((item: any) => ({
      time: new Date(BigNumber.isBigNumber(item.time) ? item.time.toNumber() : item.time),
      account: item.account,
      side: item.side,
      price: item.price,
      quantity: item.quantity
    }));
  }
  static async accountBalances(account: AccountQuery & { resync?: boolean }, preflightCache?: PreflightCallback): Promise<Balance[] | null> {
    const process = (result: any) => (result || []).map((v: any) => ({
      asset: new AssetId(v.asset.id),
      poly: v.poly,
      unavailable: v.unavailable,
      available: v.available,
      price: v.price
    }));
    const result = await this.fetch('no-cache', 'GET', `account/balances`, {
      id: account.id,
      account: account.address,
      resync: account.resync
    }, preflightCache ? (cache) => preflightCache(process(cache)) : undefined);
    return result != null ? process(result) : null;
  }
  static async accountOrders(account: { pairId?: number | string | BigNumber, active?: boolean } & AccountQuery & PageQuery): Promise<Order[]> {
    const result = await this.fetch('no-cache', 'GET', `account/orders`, {
      id: account.id,
      pairId: account.pairId?.toString(),
      active: account.active,
      account: account.address,
      page: account.page
    });
    return result.map((v: any) => this.toOrder(v));
  }
  static async accountPools(account: { pairId?: number | string | BigNumber, active?: boolean } & AccountQuery & PageQuery): Promise<Pool[]> {
    const result = await this.fetch('no-cache', 'GET', `account/pools`, {
      id: account.id,
      pairId: account.pairId?.toString(),
      active: account.active,
      account: account.address,
      page: account.page
    });
    return result.map((v: any) => this.toPool(v));
  }
  static async accountDelegatedPools(account: { pairId?: number | string | BigNumber, active?: boolean } & AccountQuery & PageQuery): Promise<DelegatedPool[]> {
    const result = await this.fetch('no-cache', 'GET', `account/pools/delegated`, {
      id: account.id,
      pairId: account.pairId?.toString(),
      active: account.active,
      account: account.address,
      page: account.page
    });
    return result.map((v: any) => this.toDelegatedPool(v));
  }
  static async accountTiers(account: { pairId?: number | string | BigNumber } & AccountQuery): Promise<AccountTier> {
    const result = await this.fetch('no-cache', 'GET', `account/tiers`, {
      id: account.id,
      pairId: account.pairId?.toString(),
      account: account.address
    });
    return result;
  }
  static async swapsBooking(asset: string, amount: string, quiet?: boolean): Promise<Booking | null> {
    try {
      return this.parseResponse(await this.fetch('no-cache', 'GET', 'swaps', { asset, amount }, undefined, quiet));
    } catch (exception: any) {
      return null;
    }
  }
  static async swapsHistory(page: number, publicKeys?: string[], statuses?: string[]): Promise<Booking[]> {
    try {
      const params: Record<string, any> = { page };
      if (publicKeys != null && publicKeys.length > 0)
        params['publicKeys'] = publicKeys;
      if (statuses != null && statuses.length > 0)
        params['status'] = statuses;
      const result = await this.fetch('no-cache', 'GET', 'swaps/history', params);
      return Array.isArray(result) ? (result as any[]).map((item) => this.parseResponse(item)) : [ ];
    } catch (exception: any) {
      return [ ];
    }
  }
  static async swapsBook(asset: string, amount: string, publicKey: string): Promise<{ transaction: string | null, amount?: string | null }> {
    return this.parseResponse(await this.fetch('no-cache', 'POST', 'swaps', { asset, amount, publicKey }));
  }
  static async swapsPreview(depositHash: string, bridgeHash: string, routingAddress: string, tokenPath: SwapLeg[], feePath: SwapLeg[], signature: string): Promise<SwapPreview> {
    return this.parseResponse(await this.fetch('no-cache', 'POST', 'swaps/preview', { depositHash, bridgeHash, routingAddress, tokenPath, feePath, signature }));
  }
  static async swapsSpend(depositHash: string, bridgeHash: string, routingAddress: string, tokenPath: SwapLeg[], feePath: SwapLeg[], signature: string): Promise<{ transaction: string | null }> {
    return this.parseResponse(await this.fetch('no-cache', 'POST', 'swaps/spend', { depositHash, bridgeHash, routingAddress, tokenPath, feePath, signature }));
  }
  static async swapsRespend(depositHash: string, broadcastHash: string, bridgeHash: string, routingAddress: string, signature: string): Promise<{ transaction: string | null }> {
    return this.parseResponse(await this.fetch('no-cache', 'POST', 'swaps/respend', { depositHash, broadcastHash, bridgeHash, routingAddress, signature }));
  }
  static getURL(): string {
    return AppData.props.exchange || '';
  }
  static toOrder(value: any): Order {
    return {
      id: new BigNumber(value.id),
      orderId: new BigNumber(value.orderId),
      pairId: new BigNumber(value.pairId),
      primaryAsset: new AssetId(value.primaryAsset),
      secondaryAsset: new AssetId(value.secondaryAsset),
      accountId: new BigNumber(value.accountId),
      blockNumber: new BigNumber(value.blockNumber),
      condition: Number(value.condition) as OrderCondition,
      side: Number(value.side) as OrderSide,
      policy: Number(value.policy) as OrderPolicy,
      price: value.price ? new BigNumber(value.price) : undefined,
      stopPrice: value.stopPrice ? new BigNumber(value.stopPrice) : undefined,
      fillingPrice: value.fillingPrice ? new BigNumber(value.fillingPrice) : undefined,
      startingValue: new BigNumber(value.startingValue),
      value: new BigNumber(value.value),
      slippage: value.slippage ? new BigNumber(value.slippage) : undefined,
      trailingStep: value.trailingStep ? new BigNumber(value.trailingStep) : undefined,
      trailingDistance: value.trailingDistance ? new BigNumber(value.trailingDistance) : undefined,
      lastPrice: value.lastPrice ? new BigNumber(value.lastPrice) : undefined,
      lastQuantity: value.lastQuantity ? new BigNumber(value.lastQuantity) : undefined,
      active: value.active
    }
  }
  static toPool(value: any): Pool {
    return {
      id: new BigNumber(value.id),
      poolId: new BigNumber(value.poolId),
      pairId: new BigNumber(value.pairId),
      primaryAsset: new AssetId(value.primaryAsset),
      secondaryAsset: new AssetId(value.secondaryAsset),
      accountId: new BigNumber(value.accountId),
      blockNumber: new BigNumber(value.blockNumber),
      initialPrice: new BigNumber(value.initialPrice),
      initialPrimaryValue: new BigNumber(value.initialPrimaryValue),
      initialSecondaryValue: new BigNumber(value.initialSecondaryValue),
      primaryValue: new BigNumber(value.primaryValue),
      secondaryValue: new BigNumber(value.secondaryValue),
      primaryRevenue: new BigNumber(value.primaryRevenue),
      secondaryRevenue: new BigNumber(value.secondaryRevenue),
      liquidity: new BigNumber(value.liquidity),
      price: new BigNumber(value.price),
      minPrice: value.minPrice ? new BigNumber(value.minPrice) : undefined,
      maxPrice: value.maxPrice ? new BigNumber(value.maxPrice) : undefined,
      feeRate: new BigNumber(value.feeRate),
      exitFee: new BigNumber(value.exitFee),
      lastAskPrice: new BigNumber(value.lastAskPrice),
      lastBidPrice: new BigNumber(value.lastBidPrice),
      volume: value.volume ? new BigNumber(value.volume) : new BigNumber(0),
      active: value.active
    }
  }
  static toDelegatedPool(value: any): DelegatedPool {
    return {
      id: new BigNumber(value.id),
      pairId: new BigNumber(value.pairId),
      delegatorAccount: value.delegatorAccount,
      accountId: new BigNumber(value.accountId),
      primaryAsset: new AssetId(value.primaryAsset),
      secondaryAsset: new AssetId(value.secondaryAsset),
      blockNumber: new BigNumber(value.blockNumber),
      rewardValue: new BigNumber(value.rewardValue),
      initialPrimaryValue: new BigNumber(value.initialPrimaryValue),
      initialSecondaryValue: new BigNumber(value.initialSecondaryValue),
      primaryValue: new BigNumber(value.primaryValue),
      secondaryValue: new BigNumber(value.secondaryValue),
      primaryReserve: value.primaryReserve ? new BigNumber(value.primaryReserve) : undefined,
      secondaryReserve: value.secondaryReserve ? new BigNumber(value.secondaryReserve) : undefined,
      primaryTotal: value.primaryTotal ? new BigNumber(value.primaryTotal) : undefined,
      secondaryTotal: value.secondaryTotal ? new BigNumber(value.secondaryTotal) : undefined,
      allocationPrice: value.allocationPrice ? new BigNumber(value.allocationPrice) : undefined,
      share: value.share ? new BigNumber(value.share) : undefined,
      volume: value.volume ? new BigNumber(value.volume) : undefined,
      feeRate: value.feeRate ? new BigNumber(value.feeRate) : undefined,
      active: value.active
    }
  }
  static toContract(value: any): Contract {
    return {
      id: new BigNumber(value.id),
      type: value.type,
      accountId: new BigNumber(value.accountId),
      account: value.account,
      deployerAccountId: new BigNumber(value.deployerAccountId),
      deployerAccount: value.deployerAccount,
      blockNumber: new BigNumber(value.blockNumber),
      parameters: value.parameters || { }
    }
  }
  static marketPolicyOf(contract: Contract | null): string {
    switch (contract ? Number(contract.parameters.marketPolicy ?? -1) : -1) {
      case MarketPolicy.Spot:
        return 'Spot';
      case MarketPolicy.Margin:
        return 'Margin';
      default:
        return 'Unknown';
    }
  }
  static toAPY(feeRate: BigNumber | number, liquidity: BigNumber, volume: BigNumber): BigNumber {
    return this.toFeeBasedAPY(volume.multipliedBy(feeRate), liquidity);
  }
  static toFeeBasedAPY(fee: BigNumber, liquidity: BigNumber): BigNumber {
    const result = liquidity?.gt(0) ? new BigNumber(1).plus(BigNumber.min(fee.dividedBy(liquidity), 1.025)).pow(365).minus(1).multipliedBy(100) : new BigNumber(0);
    return result.isFinite() ? result : new BigNumber(0);
  }
  static toPayment(leftover: BigNumber, balances: Balance[]): Record<string, string> {
    const pays: Record<string, string> = { };
    for (let i = 0; i < balances.length; i++) {
      const balance = balances[i];
      const change = BigNumber.min(balance.available, leftover);
      leftover = leftover.minus(change);
      if (change.gt(0))
        pays[balance.asset.id] = ByteUtil.bigNumberToString(change);
      if (!leftover.gt(0))
          break;
    }
    return pays;
  }
  static parsePayment(payment: Record<string, string>): { pays: { asset: AssetId, value: BigNumber }[], value: BigNumber } | null {
    let total = new BigNumber(0);
    const pays: { asset: AssetId, value: BigNumber }[] = [];
    for (let assetId of Object.keys(payment)) {
        const asset = new AssetId(assetId);
        const paying = payment[assetId];
        const value = typeof paying == 'string' || typeof paying == 'number' ? new BigNumber(paying) : null;
        if (!value || !value.gt(0) || !asset.isValid()) {
          return null;
        }

        pays.push({ asset: asset, value: value });
        total = total.plus(value);
    }
    return { pays: pays, value: total };
  }
  static parseResponse(response: any): any {
    if (response == null || typeof response != 'object' || Array.isArray(response))
      return response;

    const result: any = { };
    for (const key of Object.keys(response)) {
      const value = response[key];
      result[key] = value != null && typeof value == 'object' && typeof value.toFixed == 'function' && 's' in value && 'e' in value ? value.toFixed() : value;
    }

    return result;
  }
}