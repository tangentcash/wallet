import { Box, SegmentedControl, TextField, Tooltip } from "@radix-ui/themes";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { AppData } from "../../core/app";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Exchange, AccountTier, AggregatedLevel, AggregatedLog, AggregatedPair, Market, MarketPolicy, Order, OrderCondition, OrderSide, Balance, Pool, Cursor, ExchangeField } from "../../core/exchange";
import { useEffectAsync } from "../../core/react";
import { CrosshairMode, PriceScaleMode } from "lightweight-charts";
import { mdiAlert, mdiArrowDownBold, mdiArrowUpBold, mdiChartTimelineVariant, mdiCheckDecagram, mdiLayersMinus, mdiLayersPlus, mdiListBoxOutline } from "@mdi/js";
import { AlertBox, AlertType } from "../../components/alert";
import { AssetId, LiquidityPool } from "tangentsdk/algorithm";
import { Whitelist } from "tangentsdk/whitelist";
import { UiUtil } from "tangentsdk/ui";
import { AppStorage } from "../../core/storage";
import { Maker } from "../../components/exchange/maker";
import { AssetImage } from "../../components/asset-image";
import { AssetName } from "../../components/asset-name";
import { ChartViewType, ChartWidget, SeriesOptions, PriceScope } from "../../components/exchange/chart";
import { PoolView } from "../../components/exchange/pool";
import InfiniteScroll from 'react-infinite-scroll-component';
import BigNumber from "bignumber.js";
import OrderView from "../../components/exchange/order";
import Icon from "@mdi/react";
import Clock from "../../components/exchange/clock";
import { Assetlist } from "tangentsdk/assetlist";
import { toFancyMoney, toFancyValue } from "../../core/utils";

type AggregatedGroupedLevel = {
  ids: number[],
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

function unrollLevel(side: OrderSide, levels: number, step: number, exponent: number, feeRate: BigNumber, primaryValue: BigNumber, secondaryValue: BigNumber, feePrice: BigNumber, minPrice: BigNumber | null, maxPrice: BigNumber | null): { price: BigNumber, quantity: BigNumber }[] {
    const result: { price: BigNumber, quantity: BigNumber }[] = [];
    const concentrated = minPrice && maxPrice && minPrice.gt(0) && maxPrice.gt(0);
    const price = feePrice.multipliedBy(new BigNumber(1).plus(side == OrderSide.Buy ? feeRate.negated() : feeRate)), threshold = new BigNumber("1e-9");
    const liquidity = concentrated ? (side == OrderSide.Buy ? LiquidityPool.toLiquidity1(secondaryValue, price, minPrice) : LiquidityPool.toLiquidity0(primaryValue, price, maxPrice)) : primaryValue.multipliedBy(secondaryValue);
    let percentage = new BigNumber(0);
    for (let i = 0; i < levels; i++) {
        const isolatedPercentage = BigNumber.max(feeRate, (i + 1) * step * Math.pow(1 + exponent, i));
        percentage = percentage.plus(isolatedPercentage);
        if (side == OrderSide.Sell) {
          const primaryValue0 = primaryValue.minus(primaryValue.multipliedBy(percentage));
          if (!primaryValue0.gt(threshold) || !liquidity.isFinite()) {
            return [{ price: feePrice, quantity: primaryValue }];
          } else {
            result.push({
                price: i > 0 ? (concentrated ? LiquidityPool.toPrice0(primaryValue0, liquidity, maxPrice) : liquidity.dividedBy(primaryValue0).dividedBy(primaryValue0)) : feePrice,
                quantity: primaryValue.multipliedBy(i == levels - 1 ? new BigNumber(1).minus(percentage).plus(isolatedPercentage) : isolatedPercentage)
            });
          }
        } else if (side == OrderSide.Buy) {
          const secondaryValue1 = secondaryValue.minus(secondaryValue.multipliedBy(percentage));
          if (!secondaryValue1.gt(threshold) || !liquidity.isFinite()) {
            return [{ price: feePrice, quantity: secondaryValue }];
          } else {
            const price1 = i > 0 ? (concentrated ? LiquidityPool.toPrice1(secondaryValue1, liquidity, minPrice) : secondaryValue1.dividedBy(liquidity.dividedBy(secondaryValue1))) : feePrice;
            result.push({
                price: price1,
                quantity: secondaryValue.multipliedBy(i == levels - 1 ? new BigNumber(1).minus(percentage).plus(isolatedPercentage) : isolatedPercentage).dividedBy(price1)
            });
          }
        }
    }
    return result;
}
function unrollLevels(levels: (AggregatedGroupedLevel | AggregatedLevel)[], side: OrderSide): (AggregatedGroupedLevel | AggregatedLevel)[] {
  const depth = 16, step = 0.002, exponent = 0.1125;
  let unrolledLevels = [...levels.filter((v) => !v.curve)];
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const pool = level.curve;
    if (pool) {
      const pseudoLevels = unrollLevel(side, depth, step, exponent, pool.feeRate, pool.primaryValue, pool.secondaryValue, level.price, pool.minPrice, pool.maxPrice);
      unrolledLevels = unrolledLevels.concat(pseudoLevels.map((v) => ({
        id: (level as any).id || undefined,
        ids: (level as any).ids || undefined,
        price: v.price,
        quantity: v.quantity
      })));
    }
  }
  return unrolledLevels;
}
function reduceLevels(levels: (AggregatedGroupedLevel | AggregatedLevel)[], range: number): AggregatedGroupedLevel[] {
  const groups: Record<string, AggregatedGroupedLevel> = { };
  levels.forEach((level) => {
    const dynamicLevel: any = level;
    const dynamicIds: number[] = Array.isArray(dynamicLevel.ids) ? [...dynamicLevel.ids] : [dynamicLevel.id];
    const price = range > 0 ? level.price.dividedBy(range).integerValue().multipliedBy(range) : level.price;
    const target = groups[price.toString()];
    if (!target) {
      groups[price.toString()] = {
        ids: dynamicIds,
        price: new BigNumber(price),
        quantity: new BigNumber(level.quantity)
      };
    } else {
      target.ids = target.ids.concat(dynamicIds);
      target.quantity = target.quantity.plus(level.quantity);
    }
  });
  return Object.values(groups);
}
function policyOf(market: Market | null): string {
    switch (market ? market.marketPolicy.toNumber() : -1) {
      case MarketPolicy.Spot:
        return 'Spot';
      case MarketPolicy.Margin:
        return 'Margin';
      default:
        return 'Unknown';
    }
}
function invertLevels(levels: AggregatedGroupedLevel[]): AggregatedGroupedLevel[] {
  return levels.filter((level) => level.price.gt(0)).map((level) => ({
    ids: [...level.ids],
    price: new BigNumber(1).dividedBy(level.price),
    quantity: level.price.multipliedBy(level.quantity)
  }));
}
function invertPair(pair: AggregatedPair): AggregatedPair {
  const rec = (value: BigNumber | null) => value != null && value.gt(0) ? new BigNumber(1).dividedBy(value) : null;
  const close = pair.price.close;
  const toViewQuote = (value: BigNumber | null) => value != null && value.gt(0) && close != null && close.gt(0) ? value.dividedBy(close) : value;
  return {
    ...pair,
    primaryAsset: pair.secondaryAsset,
    secondaryAsset: pair.primaryAsset,
    price: {
      orderLiquidity: toViewQuote(pair.price.orderLiquidity),
      poolLiquidity: toViewQuote(pair.price.poolLiquidity),
      totalLiquidity: toViewQuote(pair.price.totalLiquidity),
      orderVolume: toViewQuote(pair.price.orderVolume),
      poolVolume: toViewQuote(pair.price.poolVolume),
      totalVolume: toViewQuote(pair.price.totalVolume),
      open: rec(pair.price.open),
      low: rec(pair.price.high),
      high: rec(pair.price.low),
      close: rec(close)
    }
  };
}
function invertLog(log: AggregatedLog): AggregatedLog {
  return {
    ...log,
    side: log.side == 'lp' ? log.side : (log.side == OrderSide.Buy ? OrderSide.Sell : OrderSide.Buy),
    price: log.price.gt(0) ? new BigNumber(1).dividedBy(log.price) : log.price,
    quantity: log.price.multipliedBy(log.quantity)
  };
}
function invertOrder(item: Order): Order {
  const basePrice = item.price || item.fillingPrice || item.stopPrice || null;
  const rec = (value: BigNumber | undefined) => value != null && value.gt(0) ? new BigNumber(1).dividedBy(value) : value;
  const recDelta = (value: BigNumber | undefined) => value != null && value.gt(0) && basePrice != null && basePrice.gt(0) ? value.dividedBy(basePrice.multipliedBy(basePrice)) : value;
  return {
    ...item,
    primaryAsset: item.secondaryAsset,
    primaryAssetId: item.secondaryAssetId,
    secondaryAsset: item.primaryAsset,
    secondaryAssetId: item.primaryAssetId,
    side: item.side == OrderSide.Buy ? OrderSide.Sell : OrderSide.Buy,
    price: rec(item.price),
    stopPrice: rec(item.stopPrice),
    fillingPrice: rec(item.fillingPrice),
    slippage: recDelta(item.slippage),
    trailingStep: recDelta(item.trailingStep),
    trailingDistance: recDelta(item.trailingDistance)
  };
}
export function pathOfMaker(orderbook: string): string {
  return ExchangeField.OrderbookMaker.replace('path', orderbook);
}

let accountUpdateId: any = null;

type PriceScrubStore = {
  get: () => BigNumber | null,
  set: (price: BigNumber | null) => void,
  subscribe: (listener: () => void) => () => void
};
function createPriceScrubStore(): PriceScrubStore {
  let price: BigNumber | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => price,
    set: (next) => {
      if ((next == null && price == null) || (next != null && price != null && next.eq(price)))
        return;
      price = next;
      for (const listener of listeners)
        listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }
  };
}
function ObHeroTitle(props: {
  store: PriceScrubStore,
  pair: AggregatedPair | null
}) {
  const scrub = useSyncExternalStore(props.store.subscribe, props.store.get);
  const close = scrub ?? props.pair?.price.close ?? null;
  const delta = close ? close.minus(props.pair?.price.open || new BigNumber(0)) : null;
  const dir = delta && delta.gt(0) ? 1 : (delta && delta.lt(0) ? -1 : 0);
  return (
    <>
      <div className="ob-hero-top">
        {
          props.pair?.primaryAsset && props.pair.secondaryAsset &&
          <span style={{ position: 'relative', width: 30, height: 30, flex: 'none' }}>
            <AssetImage asset={props.pair.primaryAsset} size="1" iconSize="24px"></AssetImage>
            <AssetImage asset={props.pair.secondaryAsset} size="1" iconSize="15px" style={{ position: 'absolute', bottom: -2, right: -2, border: '2px solid var(--bg)', borderRadius: '50%' }}></AssetImage>
          </span>
        }
        { props.pair?.secondaryAsset != null && props.pair.secondaryAsset.chain != 'TAN' && props.pair.primaryAsset?.chain == 'TAN' ?
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>Inv.<AssetName asset={props.pair.secondaryAsset} size="4" weight="bold" tokenOnly style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden' }}></AssetName></div> :
          <div style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden' }}><AssetName asset={props.pair?.primaryAsset || undefined} size="4" weight="bold" tokenOnly style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden' }}></AssetName>{ props.pair != null && props.pair.secondaryBase == null && props.pair.secondaryAsset ? ' in ' + (props.pair.secondaryAsset.token || props.pair.secondaryAsset.chain) : '' }</div> }
      </div>
      <div className="hero-num" style={{ fontSize: 34 }}>{ toFancyMoney(props.pair?.secondaryAsset || null, close) }</div>
      <div className="ob-delta-row">
        <span className={ 'abs' + (dir != 0 ? (dir > 0 ? ' up' : ' down') : '') }>
          { (dir > 0 ? '+ ' : (dir < 0 ? '- ' : '')) + toFancyMoney(props.pair?.secondaryAsset || null, delta ? delta.abs() : new BigNumber(0)) }
        </span>
        <span className={ 'ob-delta-pill' + (dir > 0 ? ' up' : (dir == 0 ? ' flat' : '')) }>
          { dir != 0 && <Icon path={dir > 0 ? mdiArrowUpBold : mdiArrowDownBold} size={0.55}></Icon> }
          { UiUtil.toPercentageDelta(props.pair?.price.open || new BigNumber(0), close || new BigNumber(0)) }
        </span>
        <Clock></Clock>
      </div>
    </>
  )
}
export default function OrderbookPage() {
  const params = useParams();
  const navigate = useNavigate();
  const mobile = document.body.clientWidth <= 800;
  const leftRef = useRef<HTMLDivElement>(null);
  const [search] = useSearchParams();
  const [whitelisted, setWhitelisted] = useState<boolean | null>(null);
  const [showingPools, setShowingPools] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [preset, setPreset] = useState<{ id: number, condition: OrderCondition, side: OrderSide, price: string } | null>(null);
  const [tab, setTab] = useState<'info' | 'maker' | 'book' | 'logs'>(mobile ? 'info' : 'maker');
  const [orders, setOrders] = useState<Order[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [levels, setLevels] = useState<{ ask: AggregatedGroupedLevel[], bid: AggregatedGroupedLevel[] }>({ ask: [], bid: [] })
  const [polyBalances, setPolyBalances] = useState<{ primary: Balance[], secondary: Balance[] }>({ primary: [], secondary: [] });
  const [tiers, setTiers] = useState<AccountTier | null>(null);
  const [pair, setPair] = useState<AggregatedPair | null>(null);
  const [reversed, setReversed] = useState<boolean>(false);
  const [market, setMarket] = useState<Market | null>(null);
  const [logs, setLogs] = useState<AggregatedLog[]>([]);
  const [moreLogs, setMoreLogs] = useState(true);
  const [_, setPolyAssets] = useState<{ primary: AssetId[], secondary: AssetId[] }>({ primary: [], secondary: [] });
  const [incomingTrades, setIncomingTrades] = useState<CustomEvent<any>[]>([]);
  const [incomingLevels, setIncomingLevels] = useState<CustomEvent<any>[]>([]);
  const [seriesOptions, setSeriesOptions] = useState<SeriesOptions>({
    intervals: [
      [2628000, "1mo"],
      [604800, "1w"],
      [259200, "3d"],
      [86400, "1d"],
      [14400, "4h"],
      [3600, "1h"],
      [1800, "30m"],
      [900, "15m"],
      [300, "5m"],
      [60, "1m"]
    ],
    interval: 3600,
    bars: 512,
    priceLevel: '',
    priceScope: PriceScope.All,
    view: ChartViewType.Mountain,
    price: PriceScaleMode.Normal,
    crosshair: CrosshairMode.Magnet,
    volume: false,
    inverted: false,
    showPrimary: true
  });
  const orderbook = useMemo(() => {
    if (!params.orderbook)
      return null;
    
    Exchange.setOrderbook(params.orderbook);
    return Exchange.fromOrderbookQuery(params.orderbook);
  }, [params]);
  useEffect(() => {
    const close = pair?.price.close || null;
    const price = close != null && close.gt(0) ? (close.gte(100) ? close.toFixed(2) : close.gte(1) ? close.toFixed(4) : toFancyValue(null, close, false, true)) + (pair?.secondaryAsset != null ? ' ' + UiUtil.toAssetSymbol(pair.secondaryAsset) : '') : null;
    AppData.setTitle(pair?.primaryAsset != null && pair.secondaryAsset != null ? UiUtil.toAssetSymbol(pair.primaryAsset) + '/' + UiUtil.toAssetSymbol(pair.secondaryAsset) + (price != null ? ' ' + price : '') : 'Orderbook');
  }, [orderbook, pair]);
  const makerPath = useMemo(() => {
    return params.orderbook ? pathOfMaker(params.orderbook) : undefined;
  }, [params]);
  const viewLevels = useMemo(() => reversed
    ? { ask: invertLevels(levels.bid), bid: invertLevels(levels.ask) }
    : levels, [reversed, levels]);
  const liquidity = useMemo(() => {
    const ask = viewLevels.ask.reduce((p: AggregatedGroupedLevel | null, c) => !p || c.quantity.gt(p.quantity) ? c : p, null);
    const bid = viewLevels.bid.reduce((p: AggregatedGroupedLevel | null, c) => !p || c.quantity.gt(p.quantity) ? c : p, null);
    return {
      ask: ask ? [ask.quantity, ask.price.multipliedBy(ask.quantity), viewLevels.ask.reduce((a, b) => a.plus(b.quantity), new BigNumber(0))] : [new BigNumber(0), new BigNumber(0), new BigNumber(0)],
      bid: bid ? [bid.quantity, bid.price.multipliedBy(bid.quantity), viewLevels.bid.reduce((a, b) => a.plus(b.quantity), new BigNumber(0))] : [new BigNumber(0), new BigNumber(0), new BigNumber(0)]
    };
  }, [viewLevels]);
  const spreads = useMemo((): { ask: BigNumber | null, bid: BigNumber | null } => {
    return {
      ask: viewLevels.ask.length > 0 ? viewLevels.ask[0].price : null,
      bid: viewLevels.bid.length > 0 ? viewLevels.bid[0].price : null
    }
  }, [viewLevels]);
  const balances = useMemo((): { primary: { price: BigNumber | null, value: BigNumber, total: BigNumber }, secondary: { price: BigNumber | null, value: BigNumber, total: BigNumber } } => {
    const primaryBalance = polyBalances.primary.reduce((p, n) => ({ p: n.price ? (p.p.isNaN() ? n.price : p.p.plus(n.price).div(2)) : p.p, v: p.v.plus(n.available), t: p.t.plus(n.available).plus(n.unavailable) }), { p: new BigNumber(NaN), v: new BigNumber(0), t: new BigNumber(0) });
    const secondaryBalance = polyBalances.secondary.reduce((p, n) => ({ p: n.price ? (p.p.isNaN() ? n.price : p.p.plus(n.price).div(2)) : p.p, v: p.v.plus(n.available), t: p.t.plus(n.available).plus(n.unavailable) }), { p: new BigNumber(NaN), v: new BigNumber(0), t: new BigNumber(0) });
    return {
      primary: { price: primaryBalance.p.isNaN() ? null : primaryBalance.p, value: primaryBalance.v, total: primaryBalance.t },
      secondary: { price: secondaryBalance.p.isNaN() ? null : secondaryBalance.p, value: secondaryBalance.v, total: secondaryBalance.t },
    };
  }, [polyBalances]);
  const valuation = useMemo(() => {
    const rate = pair ? Exchange.priceOf(pair.secondaryAsset)?.close : null;
    const achorPrice = rate ? balances.primary.price?.dividedBy(rate) || null : null
    const basePrice = seriesOptions.showPrimary ? achorPrice : (achorPrice ? new BigNumber(1).dividedBy(achorPrice) : null);
    const currentPrice = rate ? (seriesOptions.showPrimary ? pair?.price.close : (pair?.price.close ? new BigNumber(1).dividedBy(pair.price.close) : null)) || null : null;
    const quantity = seriesOptions.showPrimary ? balances.primary.total : balances.secondary.total;
    const worth = currentPrice ? quantity.multipliedBy(currentPrice) : null;
    const relativePL = currentPrice && basePrice ? currentPrice.minus(basePrice).dividedBy(basePrice) : new BigNumber(0);
    return {
      primary: (seriesOptions.showPrimary ? pair?.primaryAsset : pair?.secondaryAsset) || AssetId.fromHandle('?'),
      secondary: (seriesOptions.showPrimary ? pair?.secondaryAsset : pair?.primaryAsset) || AssetId.fromHandle('?'),
      basePrice: basePrice,
      currentPrice: currentPrice,
      quantity: quantity,
      worth: worth,
      absolutePL: worth?.multipliedBy(relativePL) || new BigNumber(0),
      relativePL: relativePL
    }
  }, [seriesOptions.showPrimary, pair, balances]);
  const groupedLevels = useMemo(() => {
    const range = parseFloat(seriesOptions.priceLevel);
    if (range <= 0 || isNaN(range))
      return viewLevels;

    return {
      ask: reduceLevels(viewLevels.ask, range).sort((a, b) => a.price.minus(b.price).toNumber()),
      bid: reduceLevels(viewLevels.bid, range).sort((a, b) => b.price.minus(a.price).toNumber())
    }
  }, [seriesOptions.priceLevel, viewLevels]);
  const updateTab = useCallback((value: 'info' | 'maker' | 'book' | 'logs') => {
    AppStorage.set(ExchangeField.OrderbookTab, value);
    setTab(value);
  }, []);
  const updatePreset = useCallback((side: OrderSide, price: BigNumber) => {
    setPreset({
      id: (preset?.id || 0) + 1,
      condition: OrderCondition.Limit,
      side: side,
      price: price.toString()
    });
    updateTab('maker');
  }, [preset]);
  const updateSeriesOptions = useCallback((change: (prev: any) => any) => {
    setSeriesOptions(prev => {
      const result = change(prev);
      if (typeof params.orderbook == 'string' && params.orderbook.length > 0)
        AppStorage.set(ExchangeField.OrderbookData, result);
      return result;
    });
  }, [params]);
  const updateIncomingTrades = useCallback((trades: AggregatedLog[]) => {
    setIncomingTrades([]);
    if (trades.length > 0) {
      setLogs(prev => ([...trades.sort((a, b) => a.time.getTime() - b.time.getTime()), ...prev]));
    }
  }, []);
  const findLogs = useCallback(async (refresh?: boolean, marketId?: BigNumber, pairId?: BigNumber, view?: boolean) => {
    if ((!orderbook?.marketId && !marketId) || (!pair?.id && !pairId))
      return false;

    try {
      const cursor = Cursor.offset(refresh ? 0 : logs.length);
      const page = Math.floor(cursor.offset / cursor.count);
      const data = await Exchange.marketPairLogs({ marketId: orderbook?.marketId || marketId, pairId: pair?.id || pairId, page: page });
      if (!Array.isArray(data) || !data.length) {
        if (refresh)
          setLogs([]);
        setMoreLogs(false);
        return false;
      }

      const viewData = (view == null ? reversed : view) ? data.map(invertLog) : data;
      setLogs(refresh ? viewData : prev => prev.concat(viewData));
      setMoreLogs(data.length >= cursor.count);
      return data.length > 0;
    } catch (exception) {
      AlertBox.open(AlertType.Error, 'Failed to fetch market logs: ' + (exception as Error).message);
      if (refresh)
        setLogs([]);
      setMoreLogs(false);
      return false;
    }
  }, [orderbook?.marketId, pair?.id, logs, reversed]);
  useEffectAsync(async () => {
    setLoading(true);
    try {
      if (!orderbook || !orderbook.marketId || !orderbook.primaryAsset || !orderbook.secondaryAsset)
        throw false;
      
      let result: AggregatedPair | null = null;
      Exchange.quiet = true;
      try {
        result = await Exchange.marketPair(orderbook.marketId, orderbook.primaryAsset, orderbook.secondaryAsset, false);
      } catch { }
      Exchange.quiet = false;

      let inverted = false;
      if (!result) {
        try {
          result = await Exchange.marketPair(orderbook.marketId, orderbook.secondaryAsset, orderbook.primaryAsset, false);
          inverted = result != null;
        } catch { }
      }
      if (!result)
        throw false;

      const realPair = result;
      setReversed(inverted);
      setPair(inverted ? invertPair(realPair) : realPair);
      const marketId = orderbook.marketId;
      const viewPrimary = inverted ? realPair.secondaryAsset : realPair.primaryAsset;
      const viewSecondary = inverted ? realPair.primaryAsset : realPair.secondaryAsset;
      const updateAccount = async () => {
        const account = AppData.getWalletAddress();
        if (!account)
          return;

        const ordersResult = Exchange.accountOrders({ marketId: marketId, pairId: realPair.id, address: account, active: true });
        const poolsResults = Exchange.accountPools({ marketId: marketId, pairId: realPair.id, address: account, active: true });
        const tiersResult = Exchange.accountTiers({ marketId: marketId, pairId: realPair.id, address: account });
        const balancesResult = Exchange.accountBalances({ address: account });
        try {
          setOrders(await ordersResult || []);
        } catch {  }

        try {
          setPools(await poolsResults || []);
        } catch {  }

        try {
          setTiers(await tiersResult);
        } catch { }

        try {
          const accountBalances = await balancesResult;
          setPolyAssets((poly) => {
            setPolyBalances({
              primary: accountBalances?.filter((v) => v.asset.id == viewPrimary.id || (v.poly && poly.primary.findIndex((i) => i.id == v.asset.id) != -1)) ?? [],
              secondary: accountBalances?.filter((v) => v.asset.id == viewSecondary.id || (v.poly && poly.secondary.findIndex((i) => i.id == v.asset.id) != -1)) ?? []
            });
            return poly;
          });
        } catch { }
      };
      const marketResult = Exchange.market(orderbook.marketId);
      const levelsResult = Exchange.marketPairPriceLevels(orderbook.marketId, realPair.id, 128);
      const assetsResult = Exchange.marketPairAssets(orderbook.marketId, realPair.id);
      const logsResult = findLogs(true, orderbook.marketId, realPair.id, inverted);
      try {
        setMarket(await marketResult);
      } catch (exception: any) {
        AlertBox.open(AlertType.Error, 'Failed to fetch market data: ' + (exception.message || 'unknown error'));
      }

      try {
        const marketLevels = await levelsResult;
        setLevels({
          ask: reduceLevels(unrollLevels(marketLevels?.ask || [], OrderSide.Sell), 0).sort((a, b) => a.price.minus(b.price).toNumber()),
          bid: reduceLevels(unrollLevels(marketLevels?.bid || [], OrderSide.Buy), 0).sort((a, b) => b.price.minus(a.price).toNumber())
        });
      } catch (exception: any) {
        AlertBox.open(AlertType.Error, 'Failed to fetch orderbook: ' + (exception.message || 'unknown error'));
      }

      try {
        const assetsData = await assetsResult;
        if (assetsData != null)
          setPolyAssets(inverted ? { primary: assetsData.secondary, secondary: assetsData.primary } : assetsData);
      } catch (exception: any) {
        AlertBox.open(AlertType.Error, 'Failed to fetch market poly assets: ' + (exception.message || 'unknown error'));
      }

      await Promise.all([logsResult, updateAccount()]);
      setWhitelisted(!!Whitelist.contractAddressOf(result.primaryAsset) && !!Whitelist.contractAddressOf(result.secondaryAsset));
      setLoading(false);

      const updateAccountReactive = () => {
        if (accountUpdateId != null)
          clearTimeout(accountUpdateId);
        accountUpdateId = setTimeout(() => updateAccount(), 500);
      };
      window.addEventListener('update:order', updateAccountReactive);
      window.addEventListener('update:pool', updateAccountReactive);
      return () => {
        window.removeEventListener('update:pool', updateAccountReactive);
        window.removeEventListener('update:order', updateAccountReactive);
      };
    } catch (exception: any) {
      AlertBox.open(AlertType.Error, 'Failed to fetch market: ' + (exception.message || 'unknown error'));
      navigate('/portfolio');
    }
  }, [orderbook]);
  useEffect(() => {
    if (!incomingLevels.length)
      return;

    setIncomingLevels([]);
    setLevels(prev => {
      const copy = { ask: [...prev.ask], bid: [...prev.bid] };
      const realPrimary = reversed ? pair?.secondaryAsset : pair?.primaryAsset;
      const realSecondary = reversed ? pair?.primaryAsset : pair?.secondaryAsset;
      for (let i = 0; i < incomingLevels.length; i++) {
        const data = incomingLevels[i].detail || null;
        const id = data && data.id != null ? parseInt(data.id) : NaN;
        const matchesPair = data == null || (data.pairId == null && data.primaryAsset == null && data.secondaryAsset == null)
          || (data.pairId != null && pair != null && new BigNumber(data.pairId).eq(pair.id))
          || (realPrimary != null && realSecondary != null && data.primaryAsset?.id == realPrimary.id && data.secondaryAsset?.id == realSecondary.id);
        if (!isNaN(id) && matchesPair && data.side != null && data.price != null && data.quantity != null) {
          const target = data.side == OrderSide.Buy ? copy.bid : copy.ask;
          target.forEach(l => l.ids = l.ids.filter(v => v != id));
          target.push({
            ids: [id],
            price: new BigNumber(data.price),
            quantity: new BigNumber(data.quantity),
            curve: data.curve ? {
              minPrice: new BigNumber(data.curve.minPrice),
              maxPrice: new BigNumber(data.curve.maxPrice),
              primaryValue: new BigNumber(data.curve.primaryValue),
              secondaryValue: new BigNumber(data.curve.secondaryValue),
              feeRate: new BigNumber(data.curve.feeRate),
            } : undefined
          });
        }
      }
      copy.ask = reduceLevels(unrollLevels(copy.ask.filter(l => l.ids.length > 0), OrderSide.Sell), 0).sort((a, b) => a.price.minus(b.price).toNumber());
      copy.bid = reduceLevels(unrollLevels(copy.bid.filter(l => l.ids.length > 0), OrderSide.Buy), 0).sort((a, b) => b.price.minus(a.price).toNumber());
      return copy;
    });
  }, [incomingLevels, reversed, pair]);
  useEffect(() => {
    const memorizedSeriesOptions = AppStorage.get(ExchangeField.OrderbookData);
    if (memorizedSeriesOptions != null && typeof memorizedSeriesOptions == 'object') {
      setSeriesOptions(prev => ({ ...prev, ...memorizedSeriesOptions, intervals: prev.intervals }));
    }

    if (!mobile) {
      const memorizedTab = AppStorage.get(ExchangeField.OrderbookTab);
      if (memorizedTab && ['info', 'maker', 'book', 'logs'].includes(memorizedTab)) {
        setTab(memorizedTab);
      }
    }

    const updateTrades = (event: any) => setIncomingTrades(prev => ([...prev, event]));
    const updateLevels = (event: any) => setIncomingLevels(prev => ([...prev, event]));
    window.addEventListener('update:trade', updateTrades);
    window.addEventListener('update:level', updateLevels);
    return () => {
      window.removeEventListener('update:level', updateLevels);
      window.removeEventListener('update:trade', updateTrades);
    };
  }, []);
  useEffect(() => {
    const tab: any = search.get('tab');
    if (tab && ['info', 'maker', 'book', 'logs'].includes(tab)) {
      updateTab(tab);
    }
  }, [search]);
  useEffect(() => {
    if (mobile) return;
    const el = leftRef.current;
    if (!el) return;
    const apply = () => { el.style.top = Math.min(0, window.innerHeight - el.offsetHeight - 16) + 'px'; };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener('resize', apply);
    return () => { ro.disconnect(); window.removeEventListener('resize', apply); };
  }, [mobile, orderbook?.marketId?.toString()]);

  const scrubStore = useMemo(() => createPriceScrubStore(), []);
  const symP = pair?.primaryAsset ? UiUtil.toAssetSymbol(pair.primaryAsset) : '?';
  const symQ = pair?.secondaryAsset ? UiUtil.toAssetSymbol(pair.secondaryAsset) : '?';
  const spread = spreads.ask && spreads.bid ? spreads.ask.minus(spreads.bid) : null;
  const deltaVal = pair && pair.price.close && pair.price.open ? pair.price.close.minus(pair.price.open) : null;
  const deltaDir = deltaVal && deltaVal.gt(0) ? 1 : (deltaVal && deltaVal.lt(0) ? -1 : 0);
  const change24 = UiUtil.toPercentageDelta(pair?.price.open || new BigNumber(0), pair?.price.close || new BigNumber(0)) + (deltaVal && !deltaVal.isZero() ? ' · ' + (deltaDir > 0 ? '+' : '-') + toFancyMoney(pair!.secondaryAsset, deltaVal.abs()) : '');
  const change24Style = deltaDir > 0 ? { color: 'var(--lime)' } : (deltaDir < 0 ? { color: 'var(--down)' } : undefined);
  const nameP = pair?.primaryAsset ? Assetlist.toName(pair.primaryAsset).replace((pair.primaryAsset.chain || '') + ' ', '') : symP;
  const nameQ = pair?.secondaryAsset ? Assetlist.toName(pair.secondaryAsset).replace((pair.secondaryAsset.chain || '') + ' ', '') : symQ;
  const lpApy = market && pair?.price.poolVolume?.gt(0) && pair?.price.poolLiquidity?.gt(0) ? Exchange.toAPY(pair.poolFeeRate || market.maxPoolFeeRate, pair.price.poolLiquidity, pair.price.poolVolume) : new BigNumber(0);
  const pxClose = pair?.price.close || new BigNumber(0);
  const pxRcv = balances.primary.price;
  const pxNow = pair?.primaryAsset != null ? (Exchange.priceOf(pair.primaryAsset).close || pxClose) : pxClose;
  const hasPrice = pxRcv != null && !pxRcv.isNaN() && pxRcv.gt(0) && pxNow.gt(0);
  const walletCard = (
    <div className="card">
      <div className="card-head">
        <div className="card-title">Your wallet</div>
        <div className="wallet-toggle">
          <button type="button" className={ seriesOptions.showPrimary ? 'on' : '' } onClick={ () => updateSeriesOptions(prev => ({ ...prev, showPrimary: true })) } aria-label={ symP + ' view' }><AssetImage asset={ pair?.primaryAsset || undefined } size="1" iconSize="20px"></AssetImage></button>
          <button type="button" className={ !seriesOptions.showPrimary ? 'on' : '' } onClick={ () => updateSeriesOptions(prev => ({ ...prev, showPrimary: false })) } aria-label={ symQ + ' view' }><AssetImage asset={ pair?.secondaryAsset || undefined } size="1" iconSize="20px"></AssetImage></button>
        </div>
      </div>
      <div className="wallet-view" style={{ marginTop: 10 }}>
        <div className="wv-k">{ UiUtil.toAssetSymbol(valuation.primary) } balance</div>
        <div className="wv-val">{ toFancyMoney(valuation.primary, valuation.quantity) }</div>
        <div className="wv-sub num">{ hasPrice ? toFancyValue(null, valuation.basePrice, false, true) + ' → ' + toFancyValue(null, valuation.currentPrice, false, true) : '—' }</div>
      </div>
      <div className="wallet-view" style={{ marginTop: 14 }}>
        <div className="wv-k">{ UiUtil.toAssetSymbol(valuation.secondary) } worth</div>
        <div className="wv-val">{ toFancyMoney(valuation.secondary, valuation.worth) }</div>
        <div className={ 'wv-sub num' + (hasPrice ? valuation.relativePL.gt(0) ? ' up' : valuation.relativePL.lt(0) ? ' down' : '' : '') }>{ hasPrice ? ( valuation.absolutePL.gt(0) ? '+' : valuation.absolutePL.lt(0) ? '-' : '±' ) + toFancyValue(null, valuation.absolutePL.abs(), false, true) + ' (' + ( valuation.relativePL!.gt(0) ? '+' : valuation.relativePL!.lt(0) ? '-' : '' ) + valuation.relativePL!.abs().multipliedBy(100).toFixed(2) + '%)' : '—' }</div>
      </div>
      {
        tiers != null &&
        <div className="dl dl-rule" style={{ marginTop: 12 }}>
          <div className="dl-row"><span className="dl-k">Account volume · { UiUtil.toAssetSymbol(valuation.primary) }</span><span className="dl-v num">{ toFancyMoney(valuation.primary, (seriesOptions.showPrimary !== reversed ? tiers.primary : tiers.secondary).volume) }</span></div>
        </div>
      }
    </div>
  );
  const aboutCards = (
    <>
      <div style={{ marginTop: 14 }}>{ walletCard }</div>
      <div className="card" style={{ marginTop: 14 }}>
        <p className="about-text">
          <b>{ nameP }</b> trades against <b>{ nameQ }</b> in a fully on-chain order book.
          Orders match inside the <b>{ policyOf(market) }</b> policy contract{
            whitelisted === true ? ', and the pair is verified against the token whitelist.' : (whitelisted === false ? ' — the pair is not whitelisted, trade carefully.' : '; pair verification is still being checked.')
          }
        </p>
        <div className="dl" style={{ marginTop: 12 }}>
          <div className="dl-row"><span className="dl-k">Last price</span><span className="dl-v num">{ pair?.price.close?.gt(0) ? toFancyMoney(pair.secondaryAsset, pair.price.close) : 'No trades yet' }</span></div>
          <div className="dl-row"><span className="dl-k">Best bid</span><span className="dl-v num">{ spreads.bid && spreads.bid.gt(0) ? toFancyValue(null, spreads.bid, false, true) : '—' }</span></div>
          <div className="dl-row"><span className="dl-k">Best ask</span><span className="dl-v num">{ spreads.ask && spreads.ask.gt(0) ? toFancyValue(null, spreads.ask, false, true) : '—' }</span></div>
          <div className="dl-row"><span className="dl-k">Spread</span><span className="dl-v num">{ spread ? toFancyValue(null, spread, false, true) + ' · ' + (spreads.bid && spreads.bid.gt(0) ? spread.dividedBy(spreads.bid).multipliedBy(100).toFixed(2) : '0.00') + '%' : '—' }</span></div>
          <div className="dl-row"><span className="dl-k">24h change</span><span className="dl-v num" style={ change24Style }>{ change24 }</span></div>
          <div className="dl-row"><span className="dl-k">24h range</span><span className="dl-v num">{ toFancyValue(null, pair?.price.low || null, false, true) } – { toFancyValue(null, pair?.price.high || null, false, true) }</span></div>
          <div className="dl-row"><span className="dl-k">24h volume</span><span className="dl-v num">{ toFancyMoney(pair?.secondaryAsset || null, pair?.price.totalVolume || new BigNumber(0)) }</span></div>
          <div className="dl-row"><span className="dl-k">Book liquidity</span><span className="dl-v num">{ toFancyMoney(pair?.secondaryAsset || null, pair?.price.totalLiquidity || new BigNumber(0)) }</span></div>
        </div>
        <div className="dl dl-rule">
          <div className="dl-row"><span className="dl-k">Maker fee</span><span className="dl-v num">{ (market?.minMakerFee || new BigNumber(0)).multipliedBy(100).toFixed(2) }% – { (market?.maxMakerFee || new BigNumber(0)).multipliedBy(100).toFixed(2) }%</span></div>
          <div className="dl-row"><span className="dl-k">Taker fee</span><span className="dl-v num">{ (market?.minTakerFee || new BigNumber(0)).multipliedBy(100).toFixed(2) }% – { (market?.maxTakerFee || new BigNumber(0)).multipliedBy(100).toFixed(2) }%</span></div>
          <div className="dl-row"><span className="dl-k">Fee impact rule</span><span className="dl-v num">≥ { (market?.assetVolumeTarget || new BigNumber(0)).multipliedBy(100).toFixed(0) }% of { (market?.assetResetDays || new BigNumber(0)).toString() }d volume</span></div>
          <div className="dl-row"><span className="dl-k">LP swap fee</span><span className="dl-v num">0.00% – { (market?.maxPoolFeeRate || new BigNumber(0)).multipliedBy(100).toFixed(2) }%</span></div>
          <div className="dl-row"><span className="dl-k">LP exit fee</span><span className="dl-v num">{ (market?.poolExitFee || new BigNumber(0)).multipliedBy(100).toFixed(2) }%</span></div>
          <div className="dl-row"><span className="dl-k">LP revenue</span><span className="dl-v num" style={{ color: 'var(--lime)' }}>{ lpApy.toFixed(2) }% APY</span></div>
        </div>
        <div className="tiny dim" style={{ marginTop: 12 }}>Policy account <Link className="router-link mono" style={{ fontSize: 12 }} to={ '/portfolio/' + (market?.account || '') + '?view=wallet' }>{ UiUtil.toAddress(market?.account || 'NULL', 6) }</Link></div>
      </div>
      <p className="tiny dim" style={{ marginTop: 14, textAlign: 'center' }}>The book lives on-chain · this view is served by the DEX indexer</p>
    </>
  );
  const aboutCardsGrid = (
    <>
      <div className="ob-duo">
        <div className="card">
          <div className="card-head">
            <div className="card-title">Market{
              whitelisted === true ? <Tooltip content="Verified pair against the token whitelist"><Icon className="verified" path={mdiCheckDecagram} size={0.55}></Icon></Tooltip> : (whitelisted === false ? <Tooltip content="Unverified pair — trade carefully"><Icon path={mdiAlert} color="var(--warn)" size={0.55}></Icon></Tooltip> : null)
            }</div>
            <Link className="router-link mono" style={{ fontSize: 12 }} to={ '/portfolio/' + (market?.account || '') + '?view=wallet' }>{ UiUtil.toAddress(market?.account || 'NULL', 6) }</Link>
          </div>
          <div className="stat-grid">
            <div><div className="k">Last price</div><div className="v">{ pair?.price.close?.gt(0) ? toFancyMoney(pair.secondaryAsset, pair.price.close) : 'No trades yet' }</div></div>
            <div><div className="k">24h change</div><div className="v" style={ change24Style }>{ change24 }</div></div>
            <div><div className="k">Best bid</div><div className="v">{ spreads.bid && spreads.bid.gt(0) ? toFancyValue(null, spreads.bid, false, true) : '—' }</div></div>
            <div><div className="k">Best ask</div><div className="v">{ spreads.ask && spreads.ask.gt(0) ? toFancyValue(null, spreads.ask, false, true) : '—' }</div></div>
            <div><div className="k">Spread</div><div className="v">{ spread ? toFancyValue(null, spread, false, true) + ' · ' + (spreads.bid && spreads.bid.gt(0) ? spread.dividedBy(spreads.bid).multipliedBy(100).toFixed(2) : '0.00') + '%' : '—' }</div></div>
            <div><div className="k">24h range</div><div className="v">{ toFancyValue(null, pair?.price.low || null, false, true) } – { toFancyValue(null, pair?.price.high || null, false, true) }</div></div>
            <div><div className="k">24h volume</div><div className="v">{ toFancyMoney(pair?.secondaryAsset || null, pair?.price.totalVolume || new BigNumber(0)) }</div></div>
            <div><div className="k">Book liquidity</div><div className="v">{ toFancyMoney(pair?.secondaryAsset || null, pair?.price.totalLiquidity || new BigNumber(0)) }</div></div>
          </div>
          <div className="stat-grid dl-rule" style={{ marginTop: 14, paddingTop: 14 }}>
            <div><div className="k">Maker fee</div><div className="v">{ (market?.minMakerFee || new BigNumber(0)).multipliedBy(100).toFixed(2) }% – { (market?.maxMakerFee || new BigNumber(0)).multipliedBy(100).toFixed(2) }%</div></div>
            <div><div className="k">Taker fee</div><div className="v">{ (market?.minTakerFee || new BigNumber(0)).multipliedBy(100).toFixed(2) }% – { (market?.maxTakerFee || new BigNumber(0)).multipliedBy(100).toFixed(2) }%</div></div>
            <div><div className="k">LP swap fee</div><div className="v">0.00% – { (market?.maxPoolFeeRate || new BigNumber(0)).multipliedBy(100).toFixed(2) }%</div></div>
            <div><div className="k">LP exit fee</div><div className="v">{ (market?.poolExitFee || new BigNumber(0)).multipliedBy(100).toFixed(2) }%</div></div>
            <div><div className="k">LP revenue</div><div className="v" style={{ color: 'var(--lime)' }}>{ lpApy.toFixed(2) }% APY</div></div>
            <div><div className="k">Impact rule</div><div className="v">≥ { (market?.assetVolumeTarget || new BigNumber(0)).multipliedBy(100).toFixed(0) }% / { (market?.assetResetDays || new BigNumber(0)).toString() }d</div></div>
          </div>
        </div>
        { walletCard }
      </div>
    </>
  );
  const ticketBlock = (
    <Box>
      <Maker
        path={makerPath}
        marketId={orderbook?.marketId || new BigNumber(0)}
        pairId={pair?.id || new BigNumber(0)}
        primaryAsset={pair?.primaryAsset || new AssetId()}
        secondaryAsset={pair?.secondaryAsset || new AssetId()}
        balances={loading ? undefined : polyBalances}
        prices={spreads}
        tiers={tiers || undefined}
        preset={preset}
        reversed={reversed}
        onStateChange={(state) => setShowingPools(state.pool)}></Maker>
      <Box>
        {
          !showingPools && (reversed ? orders.map(invertOrder) : orders).map((item) =>
            <Box mt="3" key={item.orderId.toString()}>
              <OrderView flash={true} item={item}></OrderView>
            </Box>)
        }
        {
          showingPools && pools.map((item) =>
            <Box mt="3" key={item.poolId.toString()}>
              <PoolView flash={true} item={item}></PoolView>
            </Box>)
        }
      </Box>
    </Box>
  );
  const bookBlock = (
    <>
      <div className="card" style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <SegmentedControl.Root value={ String(seriesOptions.priceScope) } radius="full" size="2" style={{ flex: 1, minWidth: 0 }} onValueChange={(v) => updateSeriesOptions(prev => ({ ...prev, priceScope: Number(v) }))}>
          <SegmentedControl.Item value={ String(PriceScope.Bid) }>Bids</SegmentedControl.Item>
          <SegmentedControl.Item value={ String(PriceScope.All) }>Both</SegmentedControl.Item>
          <SegmentedControl.Item value={ String(PriceScope.Ask) }>Asks</SegmentedControl.Item>
        </SegmentedControl.Root>
        <TextField.Root className="tick-input" size="2" type="number" placeholder="step" value={seriesOptions.priceLevel} onChange={(e) => updateSeriesOptions(prev => ({ ...prev, priceLevel: e.target.value }))} />
      </div>
      <div style={{ marginTop: 12 }}>
        {
          seriesOptions.priceScope != PriceScope.Ask &&
          [...groupedLevels.ask].slice(0, 12).reverse().map((item) =>
            <button className="book-row ask" key={'a' + item.price.toString()} onClick={() => updatePreset(OrderSide.Sell, item.price)}>
              <span className="apx">{ toFancyValue(null, item.price, false, true) }</span>
              <span className="track"><i style={{ width: Math.min(100, item.quantity.dividedBy(liquidity.ask[0].gt(0) ? liquidity.ask[0] : new BigNumber(1)).multipliedBy(100).toNumber()) + '%' }}></i></span>
              <span className="qty">{ toFancyValue(null, item.quantity, false, true) }</span>
            </button>)
        }
        {
          seriesOptions.priceScope == PriceScope.All &&
          <div className="book-mid">
            <span className="num" style={{ fontWeight: 800, fontSize: 16 }}>{ toFancyMoney(pair?.secondaryAsset || null, pair?.price.close || null) }</span>
            <span className="tiny dim mono">{ spread ? 'spread ' + toFancyValue(null, spread, false, true) + ' · ' + (spreads.bid?.gt(0) ? spread.dividedBy(spreads.bid).multipliedBy(100).toFixed(2) : '0.00') + '%' : 'no book' }</span>
          </div>
        }
        {
          seriesOptions.priceScope != PriceScope.Bid &&
          groupedLevels.bid.slice(0, 12).map((item) =>
            <button className="book-row bid" key={'b' + item.price.toString()} onClick={() => updatePreset(OrderSide.Buy, item.price)}>
              <span className="bpx">{ toFancyValue(null, item.price, false, true) }</span>
              <span className="track"><i style={{ width: Math.min(100, item.quantity.dividedBy(liquidity.bid[0].gt(0) ? liquidity.bid[0] : new BigNumber(1)).multipliedBy(100).toNumber()) + '%' }}></i></span>
              <span className="qty">{ toFancyValue(null, item.quantity, false, true) }</span>
            </button>)
        }
        {
          !groupedLevels.ask.length && !groupedLevels.bid.length &&
          <div className="empty" style={{ padding: '32px 24px' }}>
            <div className="art"><Icon path={mdiChartTimelineVariant} size={1.4}></Icon></div>
            <h4>The book is empty</h4>
            <p>No open orders on this pair yet. Place the first one from the Trade tab.</p>
          </div>
        }
      </div>
      </div>
      <p className="tiny dim" style={{ marginTop: 14, textAlign: 'center' }}>Tap a level → the Trade tab opens with its price filled.</p>
    </>
  );
  const logsBlock = (
    <Box style={{ marginTop: 14 }}>
      <InfiniteScroll dataLength={logs.length} hasMore={moreLogs} next={findLogs} loader={<div></div>}>
        <div className="log-list">
          {
            logs.map((item, index) => {
              const pool = item.side == 'lp';
              const buy = item.side == OrderSide.Buy;
              const action = pool ? (item.quantity.gt(0) ? 'Push' : 'Pull') : (buy ? 'Buy' : 'Sell');
              const color = pool ? 'var(--info)' : (buy ? 'var(--lime)' : 'var(--down)');
              return (
                <div className="card log-row" key={item.account + item.time.getTime().toString() + index.toString()}>
                  <span className={'tx-ico ' + (pool ? 'dex' : (buy ? 'in' : 'out'))}><Icon path={pool ? (item.quantity.gt(0) ? mdiLayersPlus : mdiLayersMinus) : (buy ? mdiArrowDownBold : mdiArrowUpBold)} size={0.9}></Icon></span>
                  <div className="tx-main">
                    <div className="tx-title"><span style={{ color }}>{action} { pool ? 'liquidity' : '' }</span></div>
                    <div className="tx-meta mono"><span className="tx-detail">{ toFancyMoney(pair?.primaryAsset || null, item.quantity, pool) } { toFancyMoney(pair?.secondaryAsset || null, item.price) ? 'at ' + toFancyMoney(pair?.secondaryAsset || null, item.price) : '' }</span></div>
                    <div className="tx-meta"><Link className="tx-hash mono" style={{ fontSize: 11.5 }} to={'/portfolio/' + item.account + '?view=wallet'}>{ UiUtil.toAddress(item.account || 'NULL', 6) }</Link><span>·</span><span>{ UiUtil.toTimePassed(item.time) }</span></div>
                  </div>
                </div>)
            })
          }
        </div>
        {
          !logs.length && !loading &&
          <div className="card">
            <div className="empty">
              <div className="art"><Icon path={mdiListBoxOutline} size={1.4}></Icon></div>
              <h4>No market activity</h4>
              <p>Fills, pushes and pulls on this book will stream here.</p>
            </div>
          </div>
        }
      </InfiniteScroll>
    </Box>
  );
  const vTab = mobile ? tab : (tab == 'info' ? 'maker' : tab);
  return (
    <Box width="100%" mx="auto" className={mobile ? undefined : 'term-grid'}>
      {
        mobile &&
        <ObHeroTitle store={scrubStore} pair={pair}></ObHeroTitle>
      }
      {
        mobile &&
        <SegmentedControl.Root value={tab} radius="full" size="3" style={{ margin: '16px 0 0' }} onValueChange={(value) => {
          updateTab(value as typeof tab);
          setPreset(null);
        }}>
          <SegmentedControl.Item value="info">Market</SegmentedControl.Item>
          <SegmentedControl.Item value="maker">Order</SegmentedControl.Item>
          <SegmentedControl.Item value="book">Book</SegmentedControl.Item>
          <SegmentedControl.Item value="logs">Logs</SegmentedControl.Item>
        </SegmentedControl.Root>
      }
      <div style={{ display: 'flex', gap: mobile ? 0 : 20, alignItems: 'flex-start' }}>
        {
          !mobile &&
          <div ref={ leftRef } className="term-left" style={{ flex: 1, minWidth: 0 }}>
            <ChartWidget
              pair={pair}
              reversed={reversed}
              whitelisted={whitelisted}
              options={seriesOptions}
              tradeEvents={incomingTrades}
              onOptionsChange={updateSeriesOptions}
              onTradesChange={updateIncomingTrades}
              onPairChange={setPair}></ChartWidget>
            {
              pair?.primaryAsset && pair.secondaryAsset && aboutCardsGrid
            }
          </div>
        }
        <div style={{ width: mobile ? '100%' : 'clamp(380px, 33%, 440px)', flex: 'none', minWidth: 0 }}>
          {
            !mobile &&
            <SegmentedControl.Root value={vTab} radius="full" size="3" style={{ marginBottom: 14 }} onValueChange={(value) => {
              updateTab(value as typeof tab);
              setPreset(null);
            }}>
              <SegmentedControl.Item value="maker">Order</SegmentedControl.Item>
              <SegmentedControl.Item value="book">Book</SegmentedControl.Item>
              <SegmentedControl.Item value="logs">Logs</SegmentedControl.Item>
            </SegmentedControl.Root>
          }
          {
            mobile &&
            <div style={{ display: tab == 'info' ? undefined : 'none', paddingTop: 16 }}>
              <ChartWidget
                pair={pair}
                reversed={reversed}
                whitelisted={whitelisted}
                options={seriesOptions}
                tradeEvents={incomingTrades}
                onOptionsChange={updateSeriesOptions}
                onTradesChange={updateIncomingTrades}
                onPairChange={setPair} bare={true} onScrub={scrubStore.set}></ChartWidget>
            </div>
          }
          {
            tab == 'info' && mobile && pair?.primaryAsset && pair.secondaryAsset && aboutCards
          }
          {
            vTab == 'maker' && ticketBlock
          }
          {
            vTab == 'book' && bookBlock
          }
          {
            vTab == 'logs' && logsBlock
          }
        </div>
      </div>
    </Box>
  );
}