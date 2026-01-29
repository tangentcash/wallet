import { AssetId, ByteUtil, Chain, Hashing, Readability, Stream, Viewable } from "tangentsdk"
import { AlertBox, AlertType } from "../components/alert"
import { Storage } from "./storage"
import { AppData } from "./app"
import BigNumber from "bignumber.js"

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
  unavailable: BigNumber,
  available: BigNumber,
  price: BigNumber | null
}

export type Order = {
    id: BigNumber;
    orderId: BigNumber;
    marketId: BigNumber;
    marketAccount: string;
    primaryAsset: AssetId;
    primaryAssetId: BigNumber;
    secondaryAsset: AssetId;
    secondaryAssetId: BigNumber;
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
    active: boolean
}

export type Pool = {
    id: BigNumber;
    poolId: BigNumber;
    pairId: BigNumber;
    primaryAsset: AssetId;
    primaryAssetId: BigNumber;
    secondaryAsset: AssetId;
    secondaryAssetId: BigNumber;
    marketId: BigNumber;
    marketAccount: string;
    accountId: BigNumber;
    blockNumber: BigNumber;
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
    lastAskPrice: BigNumber;
    lastBidPrice: BigNumber;
    active: boolean;
}

export type PageQuery = {
  page?: number;
}

export type AccountQuery = {
  id?: string | number | BigNumber,
  address?: string
}

export type Market = {
  id: BigNumber;
  accountId: BigNumber;
  account: string;
  deployerAccountId: BigNumber;
  deployerAccount: string;
  blockNumber: BigNumber;
  poolExitFee: BigNumber;
  maxPoolFeeRate: BigNumber;
  minMakerFee: BigNumber;
  maxMakerFee: BigNumber;
  makerFeeExponent: BigNumber;
  minTakerFee: BigNumber;
  maxTakerFee: BigNumber;
  takerFeeExponent: BigNumber;
  assetVolumeTarget: BigNumber;
  assetResetDays: BigNumber;
  accountResetDays: BigNumber;
  marketPolicy: BigNumber;
}

export type AggregatedPair = {
  id: BigNumber,
  primaryAsset: AssetId,
  secondaryAsset: AssetId,
  secondaryBase: string | null,
  launchTime: number,
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

export type AggregatedMatch = {
  time: Date,
  account: string,
  side: OrderSide,
  price: BigNumber,
  quantity: BigNumber
}

export type AggregatedLevel = {
  id: number,
  price: BigNumber,
  quantity: BigNumber
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

export type PriceDescriptors = Record<string, { whitelist: boolean, base: string | null, price: { open: BigNumber | null, close: BigNumber | null } }>;
export type PromiseCallback = (data: any) => void;

export enum SwapField {
  Orderbook = '__orderbook__'
}

export class Swap {
  static location: string = '';
  static subroute: string = '/swap';
  static whitelist: Set<string> = new Set<string>();
  static prices: PriceDescriptors = { };
  static contracts: Market[] = [];
  static descriptors: BlockchainInfo[] = [];
  static equityAsset: AssetId = AssetId.fromHandle('USD');
  static orderbook:  string | null = null;
  static socket: WebSocket | null = null;
  static pipeId: string | null = null;
  static awaitables: (() => void)[] | null = [];
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
  static fetchObject(data: any): any {
    if (typeof data == 'string') {
      try {
        if (!data.startsWith('0x')) {
          const numeric = new BigNumber(data, 10).dp(18);
          if (data.startsWith(numeric.toString()))
            return numeric;
        }
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
  static fetchData(data: any): any {
    if (!data.error)
      return this.fetchObject(data.result)

    const hash = ByteUtil.uint8ArrayToHexString(Hashing.hash160(ByteUtil.byteStringToUint8Array(data.error)));
    throw new Error(`${data.error} — E${hash.substring(0, 8).toUpperCase()}`);
  }
  static priceOf(primaryAsset: AssetId, secondaryAsset?: AssetId): { open: BigNumber | null, close: BigNumber | null } {
    const primarySymbol = primaryAsset.token || primaryAsset.chain || null;
    const primaryTarget = primarySymbol ? this.prices[primarySymbol] : null;
    if (secondaryAsset != null) {
      const secondarySymbol = secondaryAsset.token || secondaryAsset.chain || null;
      const secondaryTarget = secondarySymbol ? this.prices[secondarySymbol] : null;
      return {
        open: primaryTarget && primaryTarget.price.open && secondaryTarget && secondaryTarget.price.open ? primaryTarget.price.open.dividedBy(secondaryTarget.price.open) : null,
        close: primaryTarget && primaryTarget.price.close && secondaryTarget && secondaryTarget.price.close ? primaryTarget.price.close.dividedBy(secondaryTarget.price.close) : null
      };
    } else {
      return primaryTarget ? primaryTarget.price : { open: null, close: null };
    }
  }
  static toOrderbookQuery(marketId: BigNumber, primaryAsset: AssetId, secondaryAsset: AssetId): string {
    const query = new Stream();
    query.writeInteger(marketId.toNumber());
    query.writeInteger(primaryAsset.toUint256());
    query.writeInteger(secondaryAsset.toUint256());
    return query.encode();
  }
  static fromOrderbookQuery(orderbookQuery: string): { marketId: BigNumber | null, primaryAsset: AssetId | null, secondaryAsset: AssetId | null } {
    const query = Stream.decode(orderbookQuery);
    const marketId = query.readInteger(query.readType() || Viewable.Invalid);
    const primaryAsset = query.readInteger(query.readType() || Viewable.Invalid);
    const secondaryAsset = query.readInteger(query.readType() || Viewable.Invalid);
    return {
      marketId: marketId ? new BigNumber(marketId.toInteger()) : null,
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
        const whitelist = this.whitelistOf(asset);
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
  static setOrderbook(orderbook: string): void {
    const target = this.fromOrderbookQuery(orderbook);
    const value = target.marketId && target.primaryAsset && target.secondaryAsset ? orderbook : null;
    if (value != this.orderbook)
      Storage.set(SwapField.Orderbook, this.orderbook = value);
  }
  static getOrderbook(): string | null {
    return this.orderbook;
  }
  static async acquire(): Promise<void> {
    try {
      const address = AppData.getWalletAddress();
      this.location = AppData.defs.swapper || '';
      
      const connection = await this.channel(address ? [address] : []);
      if (!connection)
        throw new Error('Connection failed');

      try {
        const portfolio = await this.assetsPortfolio();
        this.prices = portfolio?.prices || { };
        this.contracts = portfolio?.markets || [];
        this.descriptors = (portfolio?.descriptors || []).sort((a, b) => Readability.toAssetSymbol(a).localeCompare(Readability.toAssetSymbol(b)));
        
        const base = this.prices['__BASE__']?.base || null;
        this.equityAsset = base ? AssetId.fromHandle(base) : this.equityAsset;
      } catch { }

      try {
        const whitelist = (await (await fetch(`${this.location}/asset/whitelist`)).json()).result;
        if (!Array.isArray(whitelist))
          throw false;

        this.whitelist = new Set<string>(whitelist as string[]);
      } catch {
        this.whitelist = new Set<string>();
      }

      this.orderbook = Storage.get(SwapField.Orderbook);
      this.dispatchEvent('swap:ready', { data: { } });
      if (this.awaitables != null) {
        for (let i = 0; i < this.awaitables.length; i++) {
          this.awaitables[i]();
        }
        this.awaitables = null;
      }
    } catch (exception: any) {
      AlertBox.open(AlertType.Error, 'Swap server error: ' + exception.message);
    }
  }
  static acquireDeferred(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.awaitables != null) {
        this.awaitables.push(resolve);
        if (this.awaitables.length == 1)
          this.acquire();
      } else {
        resolve();
      }
    });
  }
  static async fetch(method: 'GET' | 'POST' | 'DELETE', location: string, args: Record<string, any>, awaitable: boolean = true) {
    if (awaitable)
      await this.acquireDeferred();

    if (this.socket) {
      console.log('[swap-rpc]', `${this.location.replace('http', 'ws')}/${location}`, 'call', args);
      const id = (++this.requests.count).toString();
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
          this.socket.send(JSON.stringify({
            id: id,
            method: method.toLowerCase() + '://' + location,
            params: args
          }));
        } else {
          context.resolve(new Error('connection reset'));
        }
      });
      console.log('[swap-rpc]', `${this.location.replace('http', 'ws')}/${location}`, 'return', data);
      return this.fetchData(data instanceof Error ? { error: data.toString() } : data);
    } else {
      console.log('[swap-rpc]', `${this.location}/${location}`, 'call', args);
      const body = method != 'GET';
      const search = new URLSearchParams();
      if (!body && args != null && typeof args == 'object')
        Object.keys(args).forEach(key => this.storeURL(search, key, args[key]));

      const url = new URL(`${this.location}/${location}${search.size > 0 ? '?' : ''}${search.toString()}`);
      const response = await fetch(url, {
        method: method,
        headers: body && args != null ? { 'Content-Type': 'application/json' } : undefined,
        body: body && args != null ? JSON.stringify(args) : undefined,
      });
      const data = await response.json();
      console.log('[swap-rpc]', `${this.location}/${location}`, 'return', data);
      return this.fetchData(data);
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
          const socket = new WebSocket(`${this.location}/pipe`);
          socket.onopen = () => resolve(socket);
          socket.onerror = () => reject(new Error('websocket connection error'));
        });
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
                  this.pipeId = data.id;
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
        if (window.location.pathname.startsWith(this.subroute))
          setTimeout(() => this.channel(addresses), 5000);
        return false;
      }
    }

    if (this.socket != null) {
      this.socket.send(JSON.stringify({
        method: 'post://pipe',
        params: {
          accounts: addresses
        },
        id: "connect"
      }));
    }

    return true;
  }
  static async assetsPortfolio(): Promise<{ prices: PriceDescriptors, descriptors: BlockchainInfo[], markets: Market[] } | null> {
    const result = await this.fetch('GET', `assets/portfolio`, { }, false);
    if (!result)
      return null;

    return result;
  }
  static async assetQuery(query: string): Promise<AssetId[]> {
    const result = await this.fetch('GET', `asset/query`, { query: query.trim() });
    return result.map((item: any) => new AssetId(item.id));
  }
  static async assetPrices(): Promise<PriceDescriptors> {
    const result = await this.fetch('GET', `asset/prices`, { });
    return result;
  }
  static async assetDescriptors(): Promise<BlockchainInfo[]> {
    const result = await this.fetch('GET', `asset/descriptors`, { });
    return result;
  }
  static async markets(): Promise<Market[]> {
    const result = await this.fetch('GET', `markets`, { });
    return result;
  }
  static async market(marketId: number | string | BigNumber): Promise<Market> {
    return await this.fetch('GET', `market`, { id: marketId.toString() });
  }
  static async marketPairs(marketId: number | string | BigNumber): Promise<AggregatedPair[]> {
    const result = await this.fetch('GET', `market/pairs`, { id: marketId.toString() });
    for (let key in result) {
      const item = result[key];
      item.primaryAsset = new AssetId(item.primaryAsset);
      item.secondaryAsset = new AssetId(item.secondaryAsset);
    }
    return result;
  }
  static async marketPair(marketId: number | string | BigNumber, primaryAsset: AssetId, secondaryAsset: AssetId): Promise<AggregatedPair> {
    const result = await this.fetch('GET', `market/pair`, { id: marketId.toString(), primaryAssetHash: primaryAsset.id.toString(), secondaryAssetHash: secondaryAsset.id.toString() });
    result.primaryAsset = new AssetId(result.primaryAsset);
    result.secondaryAsset = new AssetId(result.secondaryAsset);
    return result;
  }
  static async marketPriceSeries(pairId: number | string | BigNumber, interval: string | number | BigNumber, page: string | number | BigNumber): Promise<{ time: number, sentiment: number, volume: BigNumber, open: BigNumber, low: BigNumber, high: BigNumber, close: BigNumber }[]> {
    const result = await this.fetch('GET', `market/price/series`, { pairId: pairId.toString(), interval: interval.toString(), page: page.toString() });
    return result.map((v: any[]) => ({
      time: v[0].toNumber(),
      sentiment: v[1].toNumber(),
      volume: v[2],
      open: v[3],
      low: v[4],
      high: v[5],
      close: v[6]
    }));
  }
  static async marketPriceLevels(marketId: number | string | BigNumber, pairId: number | string | BigNumber): Promise<{ ask: AggregatedLevel[], bid: AggregatedLevel[] }> {
    const toAggregatedLevel = (v: any[]) => ({
      id: v[0].toNumber(),
      price: v[1],
      quantity: v[2]
    });
    const result = await this.fetch('GET', `market/price/levels`, { marketId: marketId.toString(), pairId: pairId.toString() });
    return {
      ask: result.ask.map(toAggregatedLevel),
      bid: result.bid.map(toAggregatedLevel)
    };
  }
  static async marketAssets(marketId: number | string | BigNumber, pairId: number | string | BigNumber): Promise<{ primary: AssetId[], secondary: AssetId[] }> {
    const result = await this.fetch('GET', `market/assets`, {
      marketId: marketId?.toString(),
      pairId: pairId?.toString()
    });
    return {
      primary: result.primary.map((item: any) => new AssetId(item.id)),
      secondary: result.secondary.map((item: any) => new AssetId(item.id)),
    };
  }
  static async marketTrades(account: { marketId?: number | string | BigNumber, pairId?: number | string | BigNumber } & PageQuery): Promise<AggregatedMatch[]> {
    const result = await this.fetch('GET', `market/trades`, {
      marketId: account.marketId?.toString(),
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
  static async accountPortfolio(account: AccountQuery & { resync?: boolean }): Promise<{ balances: Balance[], orders: Order[], pools: Pool[] } | null> {
    const result = await this.fetch('GET', `account/portfolio`, {
      id: account.id,
      account: account.address,
      resync: account.resync
    });
    if (!result)
      return null;

    return {
      balances: (result.balances || []).map((v: any) => {
        return {
          asset: new AssetId(v.asset.id),
          unavailable: v.unavailable,
          available: v.available,
          price: v.price
        }
      }),
      orders: (result.orders || []).map((v: any) => this.toOrder(v)),
      pools: (result.pools || []).map((v: any) => this.toPool(v))
    };
  }
  static async accountBalances(account: AccountQuery & { resync?: boolean }): Promise<Balance[]> {
    const result = await this.fetch('GET', `account/balances`, {
      id: account.id,
      account: account.address,
      resync: account.resync
    });
    return result.map((v: any) => {
      return {
        asset: new AssetId(v.asset.id),
        unavailable: v.unavailable,
        available: v.available,
        price: v.price
      }
    })
  }
  static async accountOrders(account: { marketId?: number | string | BigNumber, pairId?: number | string | BigNumber, active?: boolean } & AccountQuery & PageQuery): Promise<Order[]> {
    const result = await this.fetch('GET', `account/orders`, {
      id: account.id,
      marketId: account.marketId?.toString(),
      pairId: account.pairId?.toString(),
      active: account.active,
      account: account.address,
      page: account.page
    });
    return result.map((v: any) => this.toOrder(v));
  }
  static async accountPools(account: { marketId?: number | string | BigNumber, pairId?: number | string | BigNumber } & AccountQuery & PageQuery): Promise<Pool[]> {
    const result = await this.fetch('GET', `account/pools`, {
      id: account.id,
      marketId: account.marketId?.toString(),
      pairId: account.pairId?.toString(),
      account: account.address,
      page: account.page
    });
    return result.map((v: any) => this.toPool(v));
  }
  static async accountTiers(account: { marketId?: number | string | BigNumber, pairId?: number | string | BigNumber } & AccountQuery): Promise<AccountTier> {
    const result = await this.fetch('GET', `account/tiers`, {
      id: account.id,
      marketId: account.marketId?.toString(),
      pairId: account.pairId?.toString(),
      account: account.address
    });
    return result;
  }
  static getURL(): string {
    return this.location;
  }
  static toOrder(value: any): Order {
    return {
      id: new BigNumber(value.id),
      orderId: new BigNumber(value.orderId),
      marketId: new BigNumber(value.marketId),
      marketAccount: value.marketAccount,
      primaryAsset: new AssetId(value.primaryAsset),
      primaryAssetId: new BigNumber(value.primaryAssetId),
      secondaryAsset: new AssetId(value.secondaryAsset),
      secondaryAssetId: new BigNumber(value.secondaryAssetId),
      accountId: new BigNumber(value.accountId),
      blockNumber: new BigNumber(value.blockNumber),
      condition: value.condition.toNumber() as OrderCondition,
      side: value.side.toNumber() as OrderSide,
      policy: value.policy.toNumber() as OrderPolicy,
      price: value.price ? new BigNumber(value.price) : undefined,
      stopPrice: value.stopPrice ? new BigNumber(value.stopPrice) : undefined,
      fillingPrice: value.fillingPrice ? new BigNumber(value.fillingPrice) : undefined,
      startingValue: new BigNumber(value.startingValue),
      value: new BigNumber(value.value),
      slippage: value.slippage ? new BigNumber(value.slippage) : undefined,
      trailingStep: value.trailingStep ? new BigNumber(value.trailingStep) : undefined,
      trailingDistance: value.trailingDistance ? new BigNumber(value.trailingDistance) : undefined,
      active: value.active
    }
  }
  static toPool(value: any): Pool {
    return {
      id: new BigNumber(value.id),
      poolId: new BigNumber(value.poolId),
      pairId: new BigNumber(value.pairId),
      primaryAsset: new AssetId(value.primaryAsset),
      primaryAssetId: new BigNumber(value.primaryAssetId),
      secondaryAsset: new AssetId(value.secondaryAsset),
      secondaryAssetId: new BigNumber(value.secondaryAssetId),
      marketId: new BigNumber(value.marketId),
      marketAccount: value.marketAccount,
      accountId: new BigNumber(value.accountId),
      blockNumber: new BigNumber(value.blockNumber),
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
      active: value.active
    }
  }
  static marketPolicyOf(market: Market | null): string {
    switch (market ? market.marketPolicy.toNumber() : -1) {
      case MarketPolicy.Spot:
        return 'Spot';
      case MarketPolicy.Margin:
        return 'Margin';
      default:
        return 'Unknown';
    }
  }
  static whitelistOf(asset: AssetId): boolean {
    if (!asset.token || !asset.checksum) {
      return true;
    } else if (asset.chain != Chain.policy.TOKEN_NAME) {
      return this.whitelist.has(asset.id);
    }

    for (let i = 0; i < this.contracts.length; i++) {
      const contract = this.contracts[i];
      if (asset.checksum == AssetId.checksumOf(contract.account).substring(0, asset.checksum.length))
        return true;
    }

    return false;
  }
}