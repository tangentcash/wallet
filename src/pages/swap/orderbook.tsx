import { AspectRatio, Avatar, Badge, Box, Button, Card, Dialog, Flex, Heading, IconButton, SegmentedControl, Select, Tabs, Text, TextField, Tooltip } from "@radix-ui/themes";
import { Link, useNavigate, useParams } from "react-router";
import { AppData } from "../../core/app";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Swap, AccountTier, AggregatedLevel, AggregatedMatch, AggregatedPair, Market, MarketPolicy, Order, OrderCondition, OrderSide, Balance } from "../../core/swap";
import { useEffectAsync } from "../../core/react";
import { SeriesApiRef } from "lightweight-charts-react-components";
import { BarPrice, ChartOptions, CrosshairMode, DeepPartial, IChartApi, LogicalRange, MouseEventParams, PriceScaleMode, Time } from "lightweight-charts";
import { mdiAlert, mdiArrowRightThin, mdiCheckDecagram, mdiCog, mdiCurrencyUsd } from "@mdi/js";
import { GenericBar, PriceBar, VolumeBar, ChartViewType, ChartView } from "../../components/swap/chart";
import { AlertBox, AlertType } from "../../components/alert";
import { AssetId, Readability } from "tangentsdk";
import BigNumber from "bignumber.js";
import Maker from "../../components/swap/maker";
import OrderView from "../../components/swap/order";
import Icon from "@mdi/react";
import { Storage } from "../../core/storage";

enum PriceScope {
  Bid,
  All,
  Ask
}

function mergeSeries(a: GenericBar[], b: GenericBar[], merge: (a: GenericBar, b: GenericBar) => GenericBar): GenericBar[] {
  const c: GenericBar[] = []; let i = 0, j = 0;  
  while (i < a.length && j < b.length) {
    const ax = a[i], bx = b[j], cx = c[c.length - 1];
    const t1 = ax.time as number;
    const t2 = bx.time as number;
    const t3 = cx ? cx.time as number : null;
    if (t1 < t2) {
      c.push(t3 == t1 ? merge(cx, ax) : ax);
      i++;
    } else if (t1 > t2) {
      c.push(t3 == t2 ? merge(cx, bx) : bx);
      j++;
    } else {
      c.push(t3 == t1 ? merge(cx, merge(ax, bx)) : merge(ax, bx));
      i++; j++;
    }
  }
  while (i < a.length) {
    const ax = a[i++], cx = c[c.length - 1];
    c.push(cx && cx.time == ax.time ? merge(cx, ax) : ax);
  }
  while (j < b.length) {
    const bx = b[j++], cx = c[c.length - 1];
    c.push(cx && cx.time == bx.time ? merge(cx, bx) : bx);
  }
  return c;
}
function mergePriceSeries(a: PriceBar[], b: PriceBar[]): PriceBar[] {
  return mergeSeries(a, b, (ax: GenericBar, bx: GenericBar) => {
    const ay = ax as PriceBar;
    const by = bx as PriceBar;
    return {
      time: ay.time,
      open: (ay.open + by.open) / 2,
      low: Math.min(ay.low, by.low),
      high: Math.max(ay.high, by.high),
      close: (ay.close + by.close) / 2,
      value: (ay.value + by.value) / 2
    } as GenericBar;
  }) as PriceBar[];
}
function mergeVolumeSeries(a: VolumeBar[], b: VolumeBar[]): VolumeBar[] {
  return mergeSeries(a, b, (ax: GenericBar, bx: GenericBar) => {
    const ay = ax as VolumeBar;
    const by = bx as VolumeBar;
    return {
      time: ay.time,
      value: ay.value + by.value
    } as GenericBar;
  }) as VolumeBar[];
}
function reduceLevels(levels: AggregatedLevel[], range: number): AggregatedLevel[] {
  const groups: any = { };
  levels.forEach((level) => {
    const price = Math.floor(level.price.toNumber() / range) * range;
    const target = groups[price];
    if (!target) {
      groups[price] = {
        price: new BigNumber(price),
        quantity: new BigNumber(level.quantity)
      };
    } else {
      target.quantity = target.quantity.plus(level.quantity);
    }
  });
  return Object.values(groups).map((group: any) => ({
    id: 0,
    price: group.price,
    quantity: group.quantity
  }));
}
function upperTimeSlot(interval: number, timepoint: number): number {
    return Math.ceil(timepoint / interval) * interval;
}
function lowerTimeSlot(interval: number, timepoint: number): number {
    return Math.floor(timepoint / interval) * interval;
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
function pathOfOrderbook(orderbook: string): string {
  return `__orderbook:${orderbook}__`;
}
function pathOfOrder(orderbook: string): string {
  return `__order:${orderbook}__`;
}

const UP_COLOR = '#22ab94';
const DOWN_COLOR = '#f7525f';

export default function OrderbookPage() {
  const params = useParams();
  const navigate = useNavigate();
  const mobile = document.body.clientWidth <= 800;
  const seriesRef = useRef<IChartApi>(null);
  const priceSeriesRef = useRef<SeriesApiRef<'Candlestick' | 'Bar' | 'Area' | 'Line'>>(null);
  const volumeSeriesRef = useRef<SeriesApiRef<'Histogram'>>(null);
  const [whitelisted, setWhitelisted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [preset, setPreset] = useState<{ id: number, condition: OrderCondition, side: OrderSide, price: string } | null>(null);
  const [tab, setTab] = useState<'info' | 'order' | 'book' | 'trades'>(mobile ? 'info' : 'order');
  const [orders, setOrders] = useState<Order[]>([]);
  const [levels, setLevels] = useState<{ ask: AggregatedLevel[], bid: AggregatedLevel[] }>({ ask: [], bid: [] })
  const [polyBalances, setPolyBalances] = useState<{ primary: Balance[], secondary: Balance[] }>({ primary: [], secondary: [] });
  const [tiers, setTiers] = useState<AccountTier | null>(null);
  const [legendBar, setLegendBar] = useState<{ price?: PriceBar | null, volume?: VolumeBar | null }>({ });
  const [pair, setPair] = useState<AggregatedPair | null>(null);
  const [market, setMarket] = useState<Market | null>(null);
  const [trades, setTrades] = useState<AggregatedMatch[]>([]);
  const [_, setPolyAssets] = useState<{ primary: AssetId[], secondary: AssetId[] }>({ primary: [], secondary: [] });
  const [incomingTrades, setIncomingTrades] = useState<CustomEvent<any>[]>([]);
  const [incomingLevels, setIncomingLevels] = useState<CustomEvent<any>[]>([]);
  const [seriesOptions, setSeriesOptions] = useState({
    intervals: [
      [2628000, "1M"],
      [604800, "1W"],
      [259200, "3D"],
      [86400, "1D"],
      [14400, "4H"],
      [3600, "1H"],
      [1800, "30m"],
      [900, "15m"],
      [300, "5m"],
      [60, "1m"]
    ],
    interval: 1800,
    bars: 256,
    priceLevel: '',
    priceScope: PriceScope.All,
    view: ChartViewType.Candles,
    price: PriceScaleMode.Normal,
    crosshair: CrosshairMode.Normal,
    volume: false,
    inverted: false,
    showPrimary: true
  });
  const [seriesState, setSeriesState] = useState({
    launch: Number.MIN_SAFE_INTEGER,
    from: Number.MAX_SAFE_INTEGER,
    to: Number.MIN_SAFE_INTEGER,
    ready: false,
    loading: false
  });
  const [seriesData, setSeriesData] = useState<{ price: PriceBar[], volume: VolumeBar[] }>({
    price: [],
    volume: []
  });
  const orderbook = useMemo(() => {
    if (!params.orderbook)
      return null;
    
    Swap.setOrderbook(params.orderbook);
    return Swap.fromOrderbookQuery(params.orderbook);
  }, [params]);
  const orderPath = useMemo(() => {
    return params.orderbook ? pathOfOrder(params.orderbook) : undefined;
  }, [params]);
  const liquidity = useMemo(() => {
    return {
      ask: levels.ask.reduce((a, b) => [a[0].plus(b.quantity), a[1].plus(b.price.multipliedBy(b.quantity))], [new BigNumber(0), new BigNumber(0)]),
      bid: levels.bid.reduce((a, b) => [a[0].plus(b.quantity), a[1].plus(b.price.multipliedBy(b.quantity))], [new BigNumber(0), new BigNumber(0)]),
    };
  }, [levels]);
  const balances = useMemo((): { primary: { price: BigNumber | null, value: BigNumber }, secondary: { price: BigNumber | null, value: BigNumber } } => {
    const primaryBalance = polyBalances.primary.reduce((p, n) => ({ p: n.price ? (p.p.isNaN() ? n.price : p.p.plus(n.price).div(2)) : p.p, v: p.v.plus(n.available) }), { p: new BigNumber(NaN), v: new BigNumber(0) });
    const secondaryBalance = polyBalances.secondary.reduce((p, n) => ({ p: n.price ? (p.p.isNaN() ? n.price : p.p.plus(n.price).div(2)) : p.p, v: p.v.plus(n.available) }), { p: new BigNumber(NaN), v: new BigNumber(0) });
    return {
      primary: { price: primaryBalance.p.isNaN() ? null : primaryBalance.p, value: primaryBalance.v },
      secondary: { price: secondaryBalance.p.isNaN() ? null : secondaryBalance.p, value: secondaryBalance.v },
    };
  }, [polyBalances]);
  const valuation = useMemo(() => {
    const rate = pair ? Swap.priceOf(seriesOptions.showPrimary ? pair.secondaryAsset : pair.primaryAsset)?.close : null;
    const basePrice = rate ? (seriesOptions.showPrimary ? balances.primary.price : balances.secondary.price)?.dividedBy(rate) || null : null;
    const currentPrice = rate ? (seriesOptions.showPrimary ? pair?.price.close : (pair?.price.close ? new BigNumber(1).dividedBy(pair.price.close) : null)) || null : null;
    const quantity = seriesOptions.showPrimary ? balances.primary.value : balances.secondary.value;
    const worth = currentPrice ? quantity.multipliedBy(currentPrice) : null;
    const relativePL = currentPrice && basePrice ? currentPrice.minus(basePrice).dividedBy(basePrice) : new BigNumber(0);
    return {
      primary: (seriesOptions.showPrimary ? pair?.primaryAsset : pair?.secondaryAsset) || AssetId.fromHandle('?'),
      secondary: (seriesOptions.showPrimary ? pair?.secondaryAsset : pair?.primaryAsset) || AssetId.fromHandle('?'),
      basePrice: basePrice,
      currentPrice: currentPrice,
      quantity: quantity,
      worth: worth,
      absolutePL: worth?.multipliedBy(relativePL) || null,
      relativePL: relativePL
    }
  }, [seriesOptions.showPrimary, pair, balances]);
  const groupedLevels = useMemo(() => {
    const range = parseFloat(seriesOptions.priceLevel);
    if (range <= 0 || isNaN(range))
      return levels;

    return {
      ask: reduceLevels(levels.ask, range).sort((a, b) => a.price.minus(b.price).toNumber()),
      bid: reduceLevels(levels.bid, range).sort((a, b) => b.price.minus(a.price).toNumber())
    }
  }, [seriesOptions.priceLevel, levels]);
  const seriesInterval = useMemo((): string => {
    const target = seriesOptions.intervals.find((item) => item[0] == seriesOptions.interval);
    return target ? target[1].toString() : '?';
  }, [seriesOptions.intervals]);
  const seriesChartOptions = useMemo((): DeepPartial<ChartOptions> => {
    return {
      crosshair: {
        mode: seriesOptions.crosshair,
        horzLine: {
          labelBackgroundColor: AppData.styleOf('--accent-3'),
        },
        vertLine: {
          labelBackgroundColor: AppData.styleOf('--accent-3')
        }
      },
      layout: {
          background: { color: 'transparent' },
          textColor: AppData.styleOf('--gray-12')
      },
      grid: {
        vertLines: { color: AppData.styleOf('--gray-5'), visible: seriesOptions.view == ChartViewType.Candles || seriesOptions.view == ChartViewType.Bars },
        horzLines: { color: AppData.styleOf('--gray-5'), visible: seriesOptions.view == ChartViewType.Candles || seriesOptions.view == ChartViewType.Bars }
      },
      rightPriceScale: {
        borderColor: AppData.styleOf('--gray-5'),
        autoScale: true,
        ticksVisible: true,
        invertScale: seriesOptions.inverted,
        mode: seriesOptions.price
      },
      timeScale: {
        borderColor: AppData.styleOf('--gray-5'),
        timeVisible: true,
        secondsVisible: true
      },
      localization: {
          priceFormatter: (price: BarPrice): string => Readability.toValue(null, price, false, true)
      }
    };
  }, [pair?.id, seriesOptions.crosshair, seriesOptions.view, seriesOptions.inverted, seriesOptions.price]);
  const fetchSeries = useCallback(async (range: LogicalRange | null) => {
    if (!pair || !priceSeriesRef.current || seriesState.loading)
      return;

    if (seriesState.ready) {
      if (seriesState.from <= seriesState.launch)
        return;

      const bars = range != null ? priceSeriesRef.current.api()?.barsInLogicalRange(range) || null : null;
      if (!bars || bars.barsBefore > -seriesOptions.bars * 0.25)
        return;
    }
    
    const to = upperTimeSlot(seriesOptions.interval, seriesState.ready && seriesState.from != Number.MAX_SAFE_INTEGER ? seriesState.from : Math.floor(new Date().getTime() / 1000));
    const from = Math.max(seriesState.launch, lowerTimeSlot(seriesOptions.interval, to - seriesOptions.bars * seriesOptions.interval));
    if (isNaN(from) || isNaN(to) || to <= from)
      return;
    else if (seriesState.ready && from >= seriesState.from && to <= seriesState.to)
      return;
      
    const reset = !seriesState.ready;
    setSeriesState(prev => ({ ...prev, ready: true, loading: true }));
    try {
      const result = await Swap.marketPriceSeries(pair.id, seriesOptions.interval, Math.floor(from / seriesOptions.interval));
      const price: PriceBar[] = [], volume: VolumeBar[] = [];
      let min = result.length > 0 ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
      let max = Number.MIN_SAFE_INTEGER;
      for (let i = 0; i < result.length; i++) {
        const bar = result[i];
        const time = Math.floor(bar.time / 1000) as Time;
        price.push({
            time: time,
            open: bar.open.toNumber(),
            low: bar.low.toNumber(),
            high: bar.high.toNumber(),
            close: bar.close.toNumber(),
            value: bar.close.toNumber()
        });
        volume.push({
          time: time,
          value: bar.volume.toNumber(),
          color: bar.sentiment >= 0 ? UP_COLOR : DOWN_COLOR
        });
        min = Math.min(min, time as any);
        max = Math.max(max, time as any);
      }
      
      priceSeriesRef.current?.api()?.setData([]);
      volumeSeriesRef.current?.api()?.setData([]);
      setSeriesData(prev => ({
        price: reset ? price : mergePriceSeries(prev.price, price),
        volume: reset ? volume : mergeVolumeSeries(prev.volume, volume)
      }));
      setTimeout(() => setSeriesState(prev => ({
        ...prev,
        loading: false,
        from: reset ? min : Math.min(min, prev.from, from),
        to: reset ? max : Math.max(max, prev.to)
      })), 500);
    } catch {
      setSeriesState(prev => ({ ...prev, loading: false, from: Number.MIN_SAFE_INTEGER }));
    }
  }, [pair, seriesState, seriesOptions.bars, seriesOptions.interval]);
  const fitSeries = useCallback((api?: IChartApi) => {
    if (api != null) {
      seriesRef.current = api;
    }

    const box = seriesRef.current?.chartElement().parentElement?.parentElement;
    if (box != null) {
      seriesRef.current?.resize(box.clientWidth, box.clientHeight);
    }
    
    if (seriesOptions.volume) {
      const fitVolume = () => {
        const volumeSeriesApi = volumeSeriesRef.current?.api();
        volumeSeriesApi?.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
        if (!volumeSeriesApi)
          setTimeout(fitVolume, 50);
      };
      fitVolume();
    }
  }, [seriesOptions.volume]);
  const fitLegend = useCallback((event: MouseEventParams) => {
    const priceSeriesApi = priceSeriesRef.current?.api();
    const priceBar = event && priceSeriesApi ? event.seriesData.get(priceSeriesApi) as PriceBar : undefined;
    const volumeSeriesApi = volumeSeriesRef.current?.api();
    const volumeBar = event && volumeSeriesApi ? event.seriesData.get(volumeSeriesApi) as VolumeBar : undefined;
    if (priceBar || volumeBar)
      setLegendBar({ price: priceBar, volume: volumeBar });
  }, []);
  const updatePreset = useCallback((side: OrderSide, price: BigNumber) => {
    setPreset({
      id: (preset?.id || 0) + 1,
      condition: OrderCondition.Limit,
      side: side,
      price: price.toString()
    });
    setTab('order');
  }, [preset]);
  const updateSeriesOptions = useCallback((change: (prev: any) => any) => {
    setSeriesOptions(prev => {
      const result = change(prev);
      if (typeof params.orderbook == 'string' && params.orderbook.length > 0)
        Storage.set(pathOfOrderbook(params.orderbook), result);
      return result;
    });
  }, [params]);
  useEffectAsync(async () => {
    setLoading(true);
    try {
      if (!orderbook || !orderbook.marketId || !orderbook.primaryAsset || !orderbook.secondaryAsset)
        throw false;
      
      const result = await Swap.marketPair(orderbook.marketId, orderbook.primaryAsset, orderbook.secondaryAsset);
      if (!result)
        throw false;

      setPair(result);
      setSeriesState(prev => ({
        ...prev,
        launch: Math.floor(result.launchTime / 1000),
        ready: false
      }));

      if (typeof params.orderbook == 'string' && params.orderbook.length > 0) {
        const memorizedSeriesOptions = Storage.get(pathOfOrderbook(params.orderbook));
        if (memorizedSeriesOptions != null && typeof memorizedSeriesOptions == 'object') {
          setSeriesOptions(prev => ({ ...prev, ...memorizedSeriesOptions }));
        }
      }
      
      const marketId = orderbook.marketId;
      const updateAccount = async () => {
        const account = AppData.getWalletAddress();
        if (!account)
          return;

        const ordersResult = Swap.accountOrders({ marketId: marketId, pairId: result.id, address: account, active: true });
        const tiersResult = Swap.accountTiers({ marketId: marketId, pairId: result.id, address: account });
        const balancesResult = Swap.accountBalances({ address: account });
        try {
          setOrders(await ordersResult || []);
        } catch {  }

        try {
          setTiers(await tiersResult);
        } catch { }

        try {
          const accountBalances = await balancesResult;
          setPolyAssets((poly) => {
            setPolyBalances({
              primary: accountBalances?.filter((v) => v.asset.id == result.primaryAsset.id || poly.primary.findIndex((i) => i.id == v.asset.id) != -1),
              secondary: accountBalances?.filter((v) => v.asset.id == result.secondaryAsset.id || poly.secondary.findIndex((i) => i.id == v.asset.id) != -1)
            });
            return poly;
          });
        } catch { }
      };
      const marketResult = Swap.market(orderbook.marketId);
      const levelsResult = Swap.marketPriceLevels(orderbook.marketId, result.id);
      const assetsResult = Swap.marketAssets(orderbook.marketId, result.id);
      const tradesResult = Swap.marketTrades({ marketId: orderbook.marketId, pairId: result.id });
      try {
        setMarket(await marketResult);
      } catch (exception: any) {
        AlertBox.open(AlertType.Error, 'Failed to fetch market data: ' + (exception.message || 'unknown error'));
      }

      try {
        const marketLevels = await levelsResult;
        setLevels({ ask: marketLevels?.ask || [], bid: marketLevels?.bid || [] });
      } catch (exception: any) {
        AlertBox.open(AlertType.Error, 'Failed to fetch orderbook: ' + (exception.message || 'unknown error'));
      }

      try {
        const assetsData = await assetsResult;
        if (assetsData != null)
          setPolyAssets(assetsData);
      } catch (exception: any) {
        AlertBox.open(AlertType.Error, 'Failed to fetch market poly assets: ' + (exception.message || 'unknown error'));
      }

      try {
        const tradesData = await tradesResult;
        if (tradesData != null) {
          setTrades(tradesData);
        }
      } catch (exception: any) {
        AlertBox.open(AlertType.Error, 'Failed to fetch market trades: ' + (exception.message || 'unknown error'));
      }

      await updateAccount();
      setWhitelisted(Swap.whitelistOf(result.primaryAsset) && Swap.whitelistOf(result.secondaryAsset));
      setLoading(false);
      window.addEventListener('update:order', updateAccount);
      return () => window.removeEventListener('update:order', updateAccount);
    } catch (exception: any) {
      AlertBox.open(AlertType.Error, 'Failed to fetch market: ' + (exception.message || 'unknown error'));
      navigate('/explorer');
    }
  }, [orderbook]);
  useEffectAsync(async () => {
    if (!seriesState.ready) {
      await fetchSeries(null);
    }
  }, [seriesState.ready, fetchSeries]);
  useEffect(() => {
    if (!pair || !incomingTrades.length)
      return;

    const trades: AggregatedMatch[] = [];
    const target = Swap.priceOf(pair.primaryAsset, pair.secondaryAsset);
    let sentiment = 0, price = target.close, quantity = new BigNumber(0);
    for (let i = 0; i < incomingTrades.length; i++) {
      const data = incomingTrades[i].detail || null;
      const merge = data?.primaryAsset?.id == pair?.primaryAsset.id && data?.secondaryAsset?.id == pair?.secondaryAsset.id;
      const nextAccount = data?.account || null;
      const nextSide = (data?.side || OrderSide.Buy) as OrderSide;
      const nextPrice = merge && data?.price ? new BigNumber(data?.price || 0) : null;
      const nextQuantity = merge ? new BigNumber(data?.quantity || 0) : new BigNumber(0);
      if (merge && nextPrice != null) {
        sentiment += (nextSide == OrderSide.Buy ? 1 : -1) * (1 + nextQuantity.toNumber());
        price = nextPrice;
        quantity = quantity.plus(nextQuantity);
        if (nextAccount != null) {
          trades.push({
            time: new Date(),
            account: nextAccount,
            side: nextSide,
            price: nextPrice,
            quantity: nextQuantity
          });
        }
      }
    }
    
    setIncomingTrades([]);
    if (!price)
      return;

    setPair({
      ...pair,
      price: {
        open: target.open,
        low: BigNumber.min(pair.price?.low || new BigNumber(Number.MAX_SAFE_INTEGER), price || target.open || new BigNumber(Number.MAX_SAFE_INTEGER)), 
        high: BigNumber.max(pair.price?.high || new BigNumber(Number.MIN_SAFE_INTEGER), price || target.open || new BigNumber(Number.MIN_SAFE_INTEGER)), 
        close: price,
        orderLiquidity: pair.price?.orderLiquidity || new BigNumber(0),
        poolLiquidity: pair.price?.poolLiquidity || new BigNumber(0),
        totalLiquidity: pair.price?.totalLiquidity || new BigNumber(0),
        orderVolume: (pair.price?.orderVolume || new BigNumber(0)).plus(quantity),
        poolVolume: pair.price?.poolVolume || new BigNumber(0),
        totalVolume: (pair.price?.totalVolume || new BigNumber(0)).plus(quantity),
      }
    });
    if (trades.length > 0)
      setTrades(prev => ([...trades, ...prev]));
    setSeriesData(prev => {
      if (!price)
        return prev;
      
      const priceSeries = [...prev.price], volumeSeries = [...prev.volume];
      const time = upperTimeSlot(seriesOptions.interval, Math.floor(new Date().getTime() / 1000)); 
      const prevPrice: PriceBar | null = priceSeries.length > 0 ? priceSeries[priceSeries.length - 1] : null;
      const prevVolume: VolumeBar | null = volumeSeries.length > 0 ? volumeSeries[volumeSeries.length - 1] : null;
      const mergePrice = prevPrice && prevPrice.time == time;
      const mergeVolume = prevVolume && prevVolume.time == time;
      const nextPrice: PriceBar = {
          time: time as Time,
          open: mergePrice ? prevPrice.open : price.toNumber(),
          low: mergePrice ? Math.min(prevPrice.low, price.toNumber()) : price.toNumber(),
          high: mergePrice ? Math.max(prevPrice.high, price.toNumber()) : price.toNumber(),
          close: price.toNumber(),
          value: price.toNumber()
      };
      const nextVolume: VolumeBar = {
        time: time as Time,
        value: mergeVolume ? prevVolume.value + quantity.toNumber() : quantity.toNumber(),
        color: mergeVolume && prevVolume.value * 0.5 >= quantity.toNumber() ? prevVolume.color : (sentiment >= 0 ? UP_COLOR : DOWN_COLOR)
      };
      if (mergePrice) {
        priceSeries[priceSeries.length - 1] = nextPrice;
      } else {
        priceSeries.push(nextPrice);
      }
      if (mergeVolume) {
        volumeSeries[volumeSeries.length - 1] = nextVolume;
      } else {
        volumeSeries.push(nextVolume);
      }
      return {
        price: priceSeries,
        volume: volumeSeries
      }
    });
  }, [incomingTrades, pair, seriesOptions.interval]);
  useEffect(() => {
    if (!incomingLevels.length)
      return;

    setIncomingLevels([]);
    setLevels(prev => {
      const copy = { ask: [...prev.ask], bid: [...prev.bid] };
      for (let i = 0; i < incomingLevels.length; i++) {
        const data = incomingLevels[i].detail || null;
        if (data.id != null && data.side != null && data.price != null && data.quantity != null) {
          const target = data.side == OrderSide.Buy ? copy.bid : copy.ask;
          const index = target.findIndex((v) => v.id == data.id);
          if (index == -1) {
            target.push({
              id: data.id,
              price: new BigNumber(data.price),
              quantity: new BigNumber(data.quantity)
            });
          } else {
            const level = target[index];
            level.price = new BigNumber(data.price);
            level.quantity = new BigNumber(data.quantity);
          }
        } else if (data.id != null) {
          const askIndex = copy.ask.findIndex((v) => v.id == data.id);
          const bidIndex = copy.bid.findIndex((v) => v.id == data.id);
          if (askIndex != -1)
            copy.ask.splice(askIndex, 1);
          if (bidIndex != -1)
            copy.bid.splice(bidIndex, 1);
        }
      }
      copy.ask = copy.ask.sort((a, b) => a.price.minus(b.price).toNumber());
      copy.bid = copy.bid.sort((a, b) => b.price.minus(a.price).toNumber());
      return copy;
    });
  }, [incomingLevels]);
  useEffect(() => {
    const resize = () => fitSeries(); resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [seriesOptions.volume]);
  useEffect(() => {
    const updateTrades = (event: any) => setIncomingTrades(prev => ([...prev, event]));
    const updateLevels = (event: any) => setIncomingLevels(prev => ([...prev, event]));
    window.addEventListener('update:trade', updateTrades);
    window.addEventListener('update:level', updateLevels);
    return () => {
      window.removeEventListener('update:level', updateLevels)
      window.removeEventListener('update:trade', updateTrades);
    };
  }, []);

  const ChartWidget = () => (
    <Box width="100%" mb={mobile ? undefined : '3'} style={mobile ? { } : { backgroundColor: 'var(--color-panel)', borderRadius: '22px', overflow: 'hidden' }}>
      <Flex align="center" pt={mobile ? '4' : '3'} pb={mobile ? '4' : '3'} px="3">
        <Box style={{ position: 'relative' }} mr="2">
          <Avatar size="2" fallback={orderbook?.secondaryAsset ? Readability.toAssetFallback(orderbook.secondaryAsset) : '?'} src={orderbook?.secondaryAsset ? Readability.toAssetImage(orderbook.secondaryAsset) : undefined} style={{ position: 'absolute', top: mobile ? '18px' : '24px', left: '-6px' }} />
          <Avatar size={mobile ? '3' : '4'} fallback={orderbook?.primaryAsset ? Readability.toAssetFallback(orderbook.primaryAsset) : '?'} src={orderbook?.primaryAsset ? Readability.toAssetImage(orderbook.primaryAsset) : undefined} />
        </Box>
        <Flex direction="column" width="100%">
          <Flex justify="between">
            <Tooltip content={whitelisted ? 'Well-known trading pair — current price is possibly within reasonable market ranges' : 'One or both of assets in trading pair are unknown and are possibly malicious — current price is likely not representative of actual market conditions'}>
              <Flex gap="1">
                <Text size={mobile ? '3' : '4'} style={{ height: '18px', color: 'var(--gray-12)' }}>{ orderbook?.primaryAsset ? Readability.toAssetName(orderbook.primaryAsset) : '?' }</Text>
                { <Icon path={whitelisted ? mdiCheckDecagram : mdiAlert} color={whitelisted ? 'var(--sky-9)' : 'var(--yellow-9)'} size={0.75} style={{ transform: 'translateY(3px)' }}></Icon> }
              </Flex>
            </Tooltip>
            <Text size={mobile ? '3' : '4'} style={{ height: '18px' }}>{ Readability.toValue(null, pair?.price.close || null, false, true) }</Text>
          </Flex>
          <Flex justify="between" align="center" mt={mobile ? undefined : '1'}>
            <Text size={mobile ? '1' : '2'} color="gray">{ (orderbook?.primaryAsset ? Readability.toAssetSymbol(orderbook.primaryAsset) : '?') + 'x' + (orderbook?.secondaryAsset ? Readability.toAssetSymbol(orderbook.secondaryAsset) : '?') }</Text>
            <Box>
              <Text size={mobile ? '1' : '2'}>{ Readability.toValue(null, (pair?.price.close || new BigNumber(0)).minus(pair?.price.open || new BigNumber(0)), true, true) }</Text>
              <Text size={mobile ? '1' : '2'} color="gray"> | </Text>
              <Text size={mobile ? '1' : '2'} color={ (pair?.price.open || new BigNumber(0)).gt(pair?.price.close || new BigNumber(0)) ? 'red' : ((pair?.price.open || new BigNumber(0)).eq(pair?.price.close || new BigNumber(0)) ? undefined : 'jade') }>{ Readability.toPercentageDelta(pair?.price.open || new BigNumber(0), pair?.price.close || new BigNumber(0)) }</Text>
            </Box>
          </Flex>
        </Flex>
      </Flex>
      <AspectRatio ratio={mobile ? (7 / 9) : (16 / 9)}>
        <ChartView
          type={seriesOptions.view}
          options={seriesChartOptions}
          priceRef={priceSeriesRef}
          priceData={seriesData.price}
          volumeRef={seriesOptions.volume ? volumeSeriesRef : undefined}
          volumeData={seriesData.volume}
          onInit={(api) => fitSeries(api)}
          onCrosshairMove={(e) => fitLegend(e)}
          onVisibleLogicalRangeChange={fetchSeries}></ChartView>
        <Box position="absolute" top="0" left="0" pl="3" pt="2" style={{ zIndex: 1 }}>
          {
            orderbook?.primaryAsset && orderbook?.secondaryAsset &&
            <Text>{ Readability.toAssetSymbol(orderbook.primaryAsset) }/{ Readability.toAssetSymbol(orderbook.secondaryAsset) } { seriesInterval }</Text>
          }
          {
            !mobile &&
            <Flex direction="column">
              <Text size="1"><Text color="gray" mr="1">O</Text>{ Readability.toMoney(orderbook?.secondaryAsset || null, legendBar.price?.open || null) }</Text>
              <Text size="1"><Text color="gray" mr="1">H</Text>{ Readability.toMoney(orderbook?.secondaryAsset || null, legendBar.price?.high || null) }</Text>
              <Text size="1"><Text color="gray" mr="1">L</Text>{ Readability.toMoney(orderbook?.secondaryAsset || null, legendBar.price?.low || null) }</Text>
              <Text size="1"><Text color="gray" mr="1">C</Text>{ Readability.toMoney(orderbook?.secondaryAsset || null, legendBar.price?.close || null) }</Text>
              <Text size="1"><Text color="gray" mr="1">V</Text>{ Readability.toMoney(orderbook?.primaryAsset || null, legendBar.volume?.value || null) }</Text>
            </Flex>
          }
        </Box>
      </AspectRatio>
      <Flex mt="2" px="3" pb="3" gap="1" justify={mobile ? 'between' : 'start'}>
        {
          !mobile &&
          <SegmentedControl.Root size="2" style={{ width: '100%' }} value={seriesOptions.interval.toString()} onValueChange={(e) => {
            updateSeriesOptions(prev => ({ ...prev, interval: parseInt(e) }));
            setSeriesState(prev => ({ ...prev, ready: false }));
          }}>
            {
              seriesOptions.intervals.map((item) =>
                <SegmentedControl.Item key={item[0]} value={item[0].toString()}>{ item[1] }</SegmentedControl.Item>)
            }
          </SegmentedControl.Root>
        }
        {
          mobile &&
          <Select.Root value={seriesOptions.interval.toString()} onValueChange={(e) => {
            updateSeriesOptions(prev => ({ ...prev, interval: parseInt(e) }));
            setSeriesState(prev => ({ ...prev, ready: false }));
          }}>
            <Select.Trigger />
            <Select.Content>
              <Select.Group>
                <Select.Label>Interval</Select.Label>
                {
                  seriesOptions.intervals.map((item) =>
                    <Select.Item key={item[0]} value={item[0].toString()}>{ item[1] }</Select.Item>)
                }
              </Select.Group>
            </Select.Content>
          </Select.Root>
        }
        <Dialog.Root>
          <Dialog.Trigger>
            <IconButton size="2" variant="surface" color="gray" loading={seriesState.loading}>
              <Icon path={mdiCog} size={0.8}></Icon>
            </IconButton>
          </Dialog.Trigger>
          <Dialog.Content maxWidth="450px">
            <Dialog.Title>Configure chart</Dialog.Title>
            <Flex direction="column" gap="2">
              <Select.Root value={seriesOptions.view.toString()} onValueChange={(e) => updateSeriesOptions(prev => ({ ...prev, view: parseInt(e) }))}>
                <Select.Trigger />
                <Select.Content>
                  <Select.Group>
                    <Select.Label>Chart view</Select.Label>
                    <Select.Item value={ChartViewType.Candles.toString()}>Candles view</Select.Item>
                    <Select.Item value={ChartViewType.Bars.toString()}>Bars view</Select.Item>
                    <Select.Item value={ChartViewType.Mountain.toString()}>Mountain view</Select.Item>
                    <Select.Item value={ChartViewType.Line.toString()}>Line view</Select.Item>
                  </Select.Group>
                </Select.Content>
              </Select.Root>
              <Select.Root value={seriesOptions.inverted ? '1' : '0'} onValueChange={(e) => updateSeriesOptions(prev => ({ ...prev, inverted: parseInt(e) > 0 }))}>
                <Select.Trigger />
                <Select.Content>
                  <Select.Group>
                    <Select.Label>Price view</Select.Label>
                    <Select.Item value="0">Normal price</Select.Item>
                    <Select.Item value="1">Inverted price</Select.Item>
                  </Select.Group>
                </Select.Content>
              </Select.Root>
              <Select.Root value={seriesOptions.price.toString()} onValueChange={(e) => updateSeriesOptions(prev => ({ ...prev, price: parseInt(e) }))}>
                <Select.Trigger />
                <Select.Content>
                  <Select.Group>
                    <Select.Label>Price scale</Select.Label>
                    <Select.Item value={PriceScaleMode.Normal.toString()}>Normal scale</Select.Item>
                    <Select.Item value={PriceScaleMode.Logarithmic.toString()}>Logarithmic scale</Select.Item>
                    <Select.Item value={PriceScaleMode.Percentage.toString()}>Percentage scale</Select.Item>
                    <Select.Item value={PriceScaleMode.IndexedTo100.toString()}>Index scale</Select.Item>
                  </Select.Group>
                </Select.Content>
              </Select.Root>
              <Select.Root value={seriesOptions.volume ? '1' : '0'} onValueChange={(e) => updateSeriesOptions(prev => ({ ...prev, volume: parseInt(e) > 0 }))}>
                <Select.Trigger />
                <Select.Content>
                  <Select.Group>
                    <Select.Label>Volume data</Select.Label>
                    <Select.Item value="0">Volume hidden</Select.Item>
                    <Select.Item value="1">Volume shown</Select.Item>
                  </Select.Group>
                </Select.Content>
              </Select.Root>
              {
                !mobile &&
                <Select.Root value={seriesOptions.crosshair.toString()} onValueChange={(e) => updateSeriesOptions(prev => ({ ...prev, crosshair: parseInt(e) }))}>
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Group>
                      <Select.Label>Crosshair mode</Select.Label>
                      <Select.Item value={CrosshairMode.Normal.toString()}>Normal crosshair</Select.Item>
                      <Select.Item value={CrosshairMode.Magnet.toString()}>Magnet crosshair</Select.Item>
                      <Select.Item value={CrosshairMode.Hidden.toString()}>Hidden crosshair</Select.Item>
                      <Select.Item value={CrosshairMode.MagnetOHLC.toString()}>Magent OHLC crosshair</Select.Item>
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
              }
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      </Flex>
    </Box>
  );
  return (
    <Box minWidth={mobile ? undefined : '800px'}>
      <Box px={mobile ? undefined : '3'} py={mobile ? undefined : '4'} width="100%" maxWidth="1560px" mx="auto">
        <Flex gap="3" align="start">
          { !mobile && ChartWidget() }
          <Box width={ mobile ? '100%' : '460px'}>
            <Tabs.Root value={tab} onValueChange={(e) => {
              setTab(e as any);
              if (e != 'order')
                setPreset(null);
            }}>
              <Tabs.List size="2" justify="center" color="amber" style={mobile ? { backgroundColor: 'var(--color-panel)', paddingTop: '20px' } : { }}>
                <Tabs.Trigger value="info" className="tab-padding-erase">
                  <Badge size="3" radius="large">Market</Badge>
                </Tabs.Trigger>
                <Tabs.Trigger value="order" className="tab-padding-erase">
                  <Badge size="3" radius="large">Trade</Badge>
                </Tabs.Trigger>
                <Tabs.Trigger value="book" className="tab-padding-erase">
                  <Badge size="3" radius="large">Book</Badge>
                </Tabs.Trigger>
                <Tabs.Trigger value="trades" className="tab-padding-erase">
                  <Badge size="3" radius="large">History</Badge>
                </Tabs.Trigger>
              </Tabs.List>
              <Box pt={mobile ? undefined : '3'}>
                <Tabs.Content value="info">
                  { mobile && ChartWidget() }
                  {
                    orderbook?.primaryAsset && orderbook.secondaryAsset && 
                    <Box px={mobile ? '3' : undefined}>
                      {
                        valuation != null && (balances.primary.value.gt(0) || balances.secondary.value.gt(0)) &&
                        <Card mb={mobile ? '6' : '3'} variant="surface" style={{ borderRadius: '22px' }}>
                          <Flex align="center" justify="between" mb="3">
                            <Heading size="5">P&L</Heading>
                            <SegmentedControl.Root size="1" value={seriesOptions.showPrimary ? '1' : '0'} onValueChange={(e) => updateSeriesOptions(prev => ({ ...prev, showPrimary: parseInt(e) > 0 }))}>
                              <SegmentedControl.Item value="1">
                                <Flex align="center">
                                  <Avatar size="1" fallback={Readability.toAssetFallback(orderbook.primaryAsset)} src={Readability.toAssetImage(orderbook.primaryAsset)} style={{ width: '16px', height: '16px' }} />
                                </Flex>
                              </SegmentedControl.Item>
                              <SegmentedControl.Item value="0">
                                <Flex align="center">
                                  <Avatar size="1" fallback={Readability.toAssetFallback(orderbook.secondaryAsset)} src={Readability.toAssetImage(orderbook.secondaryAsset)} style={{ width: '16px', height: '16px' }} />
                                </Flex>
                              </SegmentedControl.Item>
                            </SegmentedControl.Root>
                          </Flex>
                          <Flex direction="column">
                            <Text size="2" color="gray">{ Readability.toAssetSymbol(valuation.primary) } balance of wallet</Text>
                            <Text size="4">{ Readability.toMoney(valuation.primary, valuation.quantity) }</Text>
                          </Flex>
                          <Flex gap="1" align="center">
                            <Text size="2" color="gray">{ Readability.toValue(null, valuation.basePrice, false, true) }</Text>
                            <Icon path={mdiArrowRightThin} size={0.8}></Icon>
                            <Text size="2" color="gray">{ Readability.toValue(null, valuation.currentPrice, false, true) }</Text>
                          </Flex>
                          <Flex direction="column" mt="4">
                            <Text size="2" color="gray">{ Readability.toAssetSymbol(valuation.secondary) } cost of { Readability.toAssetSymbol(valuation.primary) }</Text>
                            <Text size="4">{ Readability.toMoney(valuation.secondary, valuation.worth) }</Text>
                            <Text size="2" color={valuation.relativePL.gt(0) ? 'jade' : (valuation.relativePL.lt(0) ? 'red' : 'gray')}>{ Readability.toValue(null, valuation.absolutePL, true, true) } ({ valuation.relativePL.gt(0) ? '+' : '' }{ valuation.relativePL.multipliedBy(100).toFixed(2) }%)</Text>
                          </Flex>
                        </Card>
                      }
                      <Card mb="3" variant="surface" style={{ borderRadius: '22px' }}>
                        <Heading mb="3" size="5">Performance 24h</Heading>
                        <Flex direction="column" gap="2">
                          <Flex justify="between" wrap="wrap" gap="1">
                            <Text size="2" color="gray">LPs revenue</Text>
                            <Text size="2" color="orange">{ (pair?.price.poolLiquidity || new BigNumber(0)).gt(0) ?(pair?.price.poolVolume || new BigNumber(0)).multipliedBy(market?.maxPoolFeeRate || new BigNumber(0)).dividedBy(pair?.price.poolLiquidity || new BigNumber(0)).multipliedBy(365 * 100).toFixed(2) : '0.00' }% APY</Text>
                          </Flex>
                          <Flex justify="between" wrap="wrap" gap="1">
                            <Text size="2" color="gray">Change</Text>
                            <Text size="2" color={ (pair?.price.open || new BigNumber(0)).gt(pair?.price.close || new BigNumber(0)) ? 'red' : ((pair?.price.open || new BigNumber(0)).eq(pair?.price.close || new BigNumber(0)) ? undefined : 'jade') }>{ Readability.toMoney(orderbook.secondaryAsset, (pair?.price.close || new BigNumber(0)).minus(pair?.price.open || new BigNumber(0)), true) }</Text>
                          </Flex>
                          <Flex justify="between" wrap="wrap" gap="1">
                            <Text size="2" color="gray">Open</Text>
                            <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toMoney(orderbook.secondaryAsset, pair?.price.open || null) }</Text>
                          </Flex>
                          <Flex justify="between" wrap="wrap" gap="1">
                            <Text size="2" color="gray">Close</Text>
                            <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toMoney(orderbook.secondaryAsset, pair?.price.close || null) }</Text>
                          </Flex>
                          <Flex justify="between" wrap="wrap" gap="1">
                            <Text size="2" color="gray">Volume</Text>
                            <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toMoney(orderbook.secondaryAsset, pair?.price.totalVolume || new BigNumber(0)) }</Text>
                          </Flex>
                          <Flex justify="between" wrap="wrap" gap="1">
                            <Text size="2" color="gray">Liquidity</Text>
                            <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toMoney(orderbook.secondaryAsset, pair?.price.totalLiquidity || new BigNumber(0)) }</Text>
                          </Flex>
                          <Flex justify="between" wrap="wrap" gap="1" mt="1">
                            <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toValue(null, pair?.price.low || null, false, true) }</Text>
                            <Text size="2" color="gray">—</Text>
                            <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toValue(null, pair?.price.high || null, false, true) }</Text>
                          </Flex>
                        </Flex>
                      </Card>
                      <Card mb="3" variant="surface" style={{ borderRadius: '22px' }}>
                        <Heading mb="3" size="5">Contract</Heading>
                        <Flex direction="column" gap="2">
                          <Flex justify="between" wrap="wrap" gap="1">
                            <Text size="2" color="gray">Pair</Text>
                            <Flex gap="1">
                              <Flex gap="2" align="center">
                                <Avatar size="1" fallback={Readability.toAssetFallback(orderbook.primaryAsset)} src={Readability.toAssetImage(orderbook.primaryAsset)} style={{ width: '16px', height: '16px' }} />
                                <Text>{ Readability.toAssetSymbol(orderbook.primaryAsset) }</Text>
                              </Flex>
                              <Text>/</Text>
                              <Flex gap="2" align="center">
                                <Avatar size="1" fallback={Readability.toAssetFallback(orderbook.secondaryAsset)} src={Readability.toAssetImage(orderbook.secondaryAsset)} style={{ width: '16px', height: '16px' }} />
                                <Text>{ Readability.toAssetSymbol(orderbook.secondaryAsset) }</Text>
                              </Flex>
                            </Flex>
                          </Flex>
                          <Flex justify="between" wrap="wrap" gap="1">
                            <Text size="2" color="gray">Risk</Text>
                            <Text size="2" style={{ color: whitelisted ? 'var(--jade-11)' : 'var(--red-11)' }}>
                              { !whitelisted && <Icon path={mdiAlert} color="var(--yellow-9)" size={0.7} style={{ transform: 'translateY(3px)', marginRight: '5px' }}></Icon> }
                              { whitelisted ? 'Low' : 'High' } risk pair
                            </Text>
                          </Flex>
                          <Flex justify="between" wrap="wrap" gap="1">
                            <Text size="2" color="gray">Type</Text>
                            <Text size="2" style={{ color: 'var(--gray-12)' }}>{ policyOf(market) } contract</Text>
                          </Flex>
                          <Flex justify="between" wrap="wrap" gap="1">
                            <Text size="2" color="gray">Program</Text>
                            <Flex>
                              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                                navigator.clipboard.writeText(market?.account || 'NULL');
                                AlertBox.open(AlertType.Info, 'Program account address copied!')
                              }}>{ Readability.toAddress(market?.account || 'NULL', 5) }</Button>
                              <Box ml="2">
                                <Link className="router-link" to={'/swap/' + market?.account}>▒▒</Link>
                              </Box>
                            </Flex>
                          </Flex>
                          <Flex justify="between" wrap="wrap" gap="1">
                            <Text size="2" color="gray">Deployer</Text>
                            <Flex>
                              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                                navigator.clipboard.writeText(market?.deployerAccount || 'NULL');
                                AlertBox.open(AlertType.Info, 'Deployer account address copied!')
                              }}>{ Readability.toAddress(market?.deployerAccount || 'NULL', 5) }</Button>
                              <Box ml="2">
                                <Link className="router-link" to={'/swap/' + market?.deployerAccount}>▒▒</Link>
                              </Box>
                            </Flex>
                          </Flex>
                        </Flex>
                      </Card>
                      <Card mb="3" variant="surface" style={{ borderRadius: '22px' }}>
                        <Heading mb="3" size="5">Rules</Heading>
                        <Flex direction="column" gap="2">
                          <Flex justify="between" wrap="wrap" gap="1">
                            <Text size="2" color="gray">Maker fee</Text>
                            <Text size="2" style={{ color: 'var(--gray-12)' }}>{ (market?.minMakerFee || new BigNumber(0)).multipliedBy(100).toFixed(2) }% — { (market?.maxMakerFee || new BigNumber(0)).multipliedBy(100).toFixed(2) }%</Text>
                          </Flex>
                          <Flex justify="between" wrap="wrap" gap="1">
                            <Text size="2" color="gray">Taker fee</Text>
                            <Text size="2" style={{ color: 'var(--gray-12)' }}>{ (market?.minTakerFee || new BigNumber(0)).multipliedBy(100).toFixed(2) }% — { (market?.maxTakerFee || new BigNumber(0)).multipliedBy(100).toFixed(2) }%</Text>
                          </Flex>
                          <Flex justify="between" wrap="wrap" gap="1">
                            <Text size="2" color="gray">Pool fee</Text>
                            <Text size="2" style={{ color: 'var(--gray-12)' }}>0.00% — { (market?.maxPoolFeeRate || new BigNumber(0)).multipliedBy(100).toFixed(2) }%</Text>
                          </Flex>
                          <Tooltip content={`Exit fee is based on fee revenue of a pool and will be charged on pool withdrawal. Any change to exit fee only affects new pools, existing pools are not affected.`}>
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">Pool exit fee</Text>
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>{ (market?.poolExitFee || new BigNumber(0)).multipliedBy(100).toFixed(2) }%</Text>
                            </Flex>
                          </Tooltip>
                          <Tooltip content={`To reach lowest maker/taker fees, account impact must cover at least ${(market?.assetVolumeTarget || new BigNumber(0)).multipliedBy(100).toFixed(0) }% of ${ (market?.assetResetDays || new BigNumber(0)).toString() } day volume of this market pair within ${ (market?.accountResetDays || new BigNumber(0)).toString() } days`}>
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">Impact rule</Text>
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>≥ { (market?.assetVolumeTarget || new BigNumber(0)).multipliedBy(100).toFixed(0) }% of { (market?.assetResetDays || new BigNumber(0)).toString() }d VOL</Text>
                            </Flex>
                          </Tooltip>
                          <Tooltip content={`Maker/taker fee impact difficulty: fee will get lower exponentially as account impact grows, higher fee impact difficulty will slow down the fee discounts on smaller impact accounts and speed up the fee discounts on higher impact accounts`}>
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">Impact difficuly</Text>
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>{ (market?.makerFeeExponent || new BigNumber(0)).multipliedBy(100).toFixed(0) }% — { (market?.takerFeeExponent || new BigNumber(0)).multipliedBy(100).toFixed(0) }%</Text>
                            </Flex>
                          </Tooltip>
                        </Flex>
                      </Card>
                    </Box>
                  }
                </Tabs.Content>
                <Tabs.Content value="order">
                  <Box px={mobile ? '3' : undefined} pt={mobile ? '4' : undefined}>
                    <Maker
                      path={orderPath}
                      marketId={orderbook?.marketId || new BigNumber(0)}
                      pairId={pair?.id || new BigNumber(0)}
                      primaryAsset={orderbook?.primaryAsset || new AssetId()}
                      secondaryAsset={orderbook?.secondaryAsset || new AssetId()}
                      balances={loading ? undefined : polyBalances}
                      tiers={tiers || undefined}
                      preset={preset}></Maker>
                    {
                      orders.map((item) =>
                        <Box mt="3" key={item.orderId.toString()}>
                          <OrderView flash={true} item={item}></OrderView>
                        </Box>)
                    }
                  </Box>
                </Tabs.Content>
                <Tabs.Content value="book">
                  <Box px={mobile ? '3' : undefined} pt={mobile ? '4' : undefined}>
                    <Card variant="surface" style={{ borderRadius: '22px' }}>
                      <Box mb="2">
                        <SegmentedControl.Root mb="2" style={{ width: '100%' }} value={seriesOptions.priceScope.toString()} onValueChange={(e) => updateSeriesOptions(prev => ({ ...prev, priceScope: parseInt(e) }))}>
                          <SegmentedControl.Item value={PriceScope.Bid.toString()}>Bid</SegmentedControl.Item>
                          <SegmentedControl.Item value={PriceScope.All.toString()}>/</SegmentedControl.Item>
                          <SegmentedControl.Item value={PriceScope.Ask.toString()}>Ask</SegmentedControl.Item>
                        </SegmentedControl.Root>
                        <TextField.Root type="number" placeholder="Price distance" value={seriesOptions.priceLevel} onChange={(e) => updateSeriesOptions(prev => ({ ...prev, priceLevel: e.target.value }))}>
                          <TextField.Slot>
                            <Icon path={mdiCurrencyUsd} />
                          </TextField.Slot>
                        </TextField.Root>
                      </Box>
                      <Flex justify={
                        seriesOptions.priceScope == PriceScope.All ? 'between' : (seriesOptions.priceScope == PriceScope.Bid ? 'start' : 'end')
                      } style={{ borderTopLeftRadius: '12px', borderTopRightRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--gray-3)' }} px="1" py="2" position="relative">
                        {
                          seriesOptions.priceScope != PriceScope.Ask &&
                          <>
                            <Box position="absolute" top="0" left="0" right={`${seriesOptions.priceScope == PriceScope.All ? liquidity.bid[0].dividedBy(liquidity.bid[0].plus(liquidity.ask[0])).multipliedBy(100) : 0}%`} bottom="0" style={{ zIndex: 0, backgroundColor: 'var(--jade-7)' }}></Box>
                            <Text size="2" style={{ zIndex: 1, color: 'var(--jade-11)' }}>{ Readability.toMoney(orderbook?.primaryAsset || null, liquidity.bid[0]) }</Text>
                          </>
                        }
                        {
                          seriesOptions.priceScope != PriceScope.Bid &&
                          <>
                            <Box position="absolute" top="0" left={`${seriesOptions.priceScope == PriceScope.All ? new BigNumber(100).minus(liquidity.ask[0].dividedBy(liquidity.bid[0].plus(liquidity.ask[0])).multipliedBy(100)) : 0}%`} right="0" bottom="0" style={{ zIndex: 0, backgroundColor: 'var(--red-7)' }}></Box>
                            <Text size="2" style={{ zIndex: 1, color: 'var(--red-11)' }}>{ Readability.toMoney(orderbook?.primaryAsset || null, liquidity.ask[0]) }</Text>
                          </>
                        }
                      </Flex>
                      <Flex style={{ borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--gray-3)' }}>
                        {
                          seriesOptions.priceScope != PriceScope.Ask &&
                          <Box width={seriesOptions.priceScope == PriceScope.All ? '50%' : '100%'}>
                            {
                              groupedLevels.bid.map((item) =>
                                <Tooltip key={item.price.toString()} content={`Buy ${Readability.toMoney(orderbook?.primaryAsset || null, item.quantity)} at ≤ ${Readability.toMoney(orderbook?.secondaryAsset || null, item.price)}`}>
                                  <Button variant="ghost" radius="none" style={{ width: '100%', height: 'auto', padding: 0, margin: 0 }} onClick={() => updatePreset(OrderSide.Buy, item.price)}>
                                    <Flex width="100%" justify="start" px="1" py="1" position="relative">
                                      <Box position="absolute" top="0" left={`${100 - 100 * item.quantity.dividedBy(liquidity.bid[0]).toNumber()}%`} right="0" bottom="0" style={{ zIndex: 0, backgroundColor: 'var(--jade-7)' }}></Box>
                                      <Text size="2" style={{ zIndex: 1, color: 'var(--jade-11)' }}>{ Readability.toValue(null, item.price, false, true) }</Text>
                                    </Flex>
                                  </Button>
                                </Tooltip>)
                            }
                            {
                              !groupedLevels.bid.length &&
                              <Box height="28px" style={{ backgroundColor: 'var(--gray-4)' }}></Box>
                            }
                          </Box>
                        }
                        {
                          seriesOptions.priceScope != PriceScope.Bid &&
                          <Box width={seriesOptions.priceScope == PriceScope.All ? '50%' : '100%'}>
                            {
                              groupedLevels.ask.map((item) =>
                                <Tooltip key={item.price.toString()} content={`Sell ${Readability.toMoney(orderbook?.primaryAsset || null, item.quantity)} at ≥ ${Readability.toMoney(orderbook?.secondaryAsset || null, item.price)}`}>
                                  <Button variant="ghost" radius="none" style={{ width: '100%', height: 'auto', padding: 0, margin: 0 }} onClick={() => updatePreset(OrderSide.Sell, item.price)}>
                                    <Flex width="100%" justify="end" px="1" py="1" position="relative">
                                      <Box position="absolute" top="0" left="0" right={`${100 - 100 * item.quantity.dividedBy(liquidity.ask[0]).toNumber()}%`} bottom="0" style={{ zIndex: 0, backgroundColor: 'var(--red-7)' }}></Box>
                                      <Text size="2" style={{ zIndex: 1, color: 'var(--red-11)' }}>{ Readability.toValue(null, item.price, false, true) }</Text>
                                    </Flex>
                                  </Button>
                                </Tooltip>)
                            }
                            {
                              !groupedLevels.ask.length &&
                              <Box height="28px" style={{ backgroundColor: 'var(--gray-5)' }}></Box>
                            }
                          </Box>
                        }
                      </Flex>
                    </Card>
                  </Box>
                </Tabs.Content>
                <Tabs.Content value="trades">
                  <Box px={mobile ? '3' : undefined} pt={mobile ? '4' : undefined}>
                    {
                      trades.map((item) =>
                        <Box key={item.account + item.time.getTime()} mb="3" style={{ width: '100%', height: 'auto', backgroundColor: 'var(--color-panel)', borderRadius: '22px' }}>
                          <Flex direction="column" gap="2" style={{ padding: '12px' }}>
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">At</Text>
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toMoney(orderbook?.secondaryAsset || null, item.price) }</Text>
                            </Flex>
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color={item.side == OrderSide.Buy ? 'jade' : 'red'}>{ item.side == OrderSide.Buy ? 'Buy' : 'Sell' }</Text>
                              <Text size="2" color={item.side == OrderSide.Buy ? 'jade' : 'red'}>{ Readability.toMoney(orderbook?.primaryAsset || null, item.quantity) }</Text>
                            </Flex>
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>With</Text>
                              <Flex>
                                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                                  navigator.clipboard.writeText(item.account || 'NULL');
                                  AlertBox.open(AlertType.Info, 'Account address copied!')
                                }}>{ Readability.toAddress(item.account || 'NULL', 5) }</Button>
                                <Box ml="2">
                                  <Link className="router-link" to={'/swap/' + item.account}>▒▒</Link>
                                </Box>
                              </Flex>
                            </Flex>
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">Age</Text>
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toTimePassed(item.time) }</Text>
                            </Flex>
                          </Flex>
                        </Box>)
                    }
                    {
                      !trades.length &&
                      <Flex justify="center">
                        <Text>No activity</Text>
                      </Flex>
                    }
                  </Box>
                </Tabs.Content>
              </Box>
            </Tabs.Root>
          </Box>
        </Flex>
      </Box>
    </Box>
  );
}