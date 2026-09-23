import { Box, Dialog, Flex, Select, Tabs, Text, Tooltip } from "@radix-ui/themes";
import { AppData } from "../../core/app";
import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Exchange, AggregatedLog, AggregatedPair, OrderSide } from "../../core/exchange";
import { useEffectAsync } from "../../core/react";
import { AreaSeries, BarSeries, CandlestickSeries, Chart, HistogramSeries, LineSeries, TimeScale, TimeScaleFitContentTrigger, SeriesApiRef } from "lightweight-charts-react-components";
import { LogicalRangeChangeEventHandler, MouseEventHandler, BarPrice, ChartOptions, CrosshairMode, DeepPartial, IChartApi, LogicalRange, MouseEventParams, PriceScaleMode, Time } from "lightweight-charts";
import { mdiAlert, mdiArrowDownBold, mdiArrowUpBold, mdiCheckDecagram, mdiCog, mdiTimelapse } from "@mdi/js";
import { AssetId } from "tangentsdk/algorithm";
import { UiUtil } from "tangentsdk/ui";
import { Assetlist } from "tangentsdk/assetlist";
import { AssetImage } from "../../components/asset-image";
import Color from 'colorjs.io';
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";
import Clock from "./clock";

export enum PriceScope {
  Bid,
  All,
  Ask
}

export enum ChartViewType {
  Candles,
  Bars,
  Mountain,
  Line
}

export type SeriesOptions = {
    intervals: (string | number)[][];
    interval: number;
    bars: number;
    priceLevel: string;
    priceScope: PriceScope;
    view: ChartViewType;
    price: PriceScaleMode;
    crosshair: CrosshairMode;
    volume: boolean;
    inverted: boolean;
    showPrimary: boolean;
};

export type ChartProps = {
  orderbook: { marketId: BigNumber | null, primaryAsset: AssetId | null, secondaryAsset: AssetId | null } | null,
  pair: AggregatedPair | null,
  whitelisted: boolean | null,
  options: SeriesOptions,
  tradeEvents: CustomEvent<any>[],
  onOptionsChange: (callback: (prev: SeriesOptions) => SeriesOptions) => any,
  onTradesChange: (trades: AggregatedLog[]) => any,
  onPairChange: (pair: AggregatedPair) => any,
  onScrub?: (price: BigNumber | null) => any,
  bare?: boolean,
};

export type GenericBar = {
  time: Time
};

export type PriceBar = GenericBar & {
  open: number,
  low: number,
  high: number,
  close: number,
  value: number
};

export type VolumeBar = GenericBar & {
  value: number,
  color: string
};

const UP_COLOR = '#b3f42e';
const UP_VCOLOR = UP_COLOR + '99';
const DOWN_COLOR = '#f7525f';
const DOWN_VCOLOR = DOWN_COLOR + '99';
let colors: Record<string, string> = { };
let styles: CSSStyleDeclaration | null = null;
let appearance: string | null = null;
let crosshairTimeout: number | null = null;
let crosshairLogical: string | null = null;

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
function upperTimeSlot(interval: number, timepoint: number): number {
    return Math.ceil(timepoint / interval) * interval;
}
function lowerTimeSlot(interval: number, timepoint: number): number {
    return Math.floor(timepoint / interval) * interval;
}
function colorOf(property: string): string | undefined {
  if (appearance != AppData.props.appearance) {
    appearance = AppData.props.appearance;
    colors = { };
    styles = null;
  }

  if (!styles) {
    const element = document.querySelector('.radix-themes')
    if (element != null) {
      styles = getComputedStyle(element);
    }
  }

  const cache = colors[property];
  if (cache != null)
    return cache;

  let result = styles?.getPropertyValue(property) || undefined;
  if (!result)
    return undefined;

  if (!result.startsWith('#') && !result.startsWith('rgb')) {
    try {
      result = new Color(result).to('srgb').toString();
    } catch {
      return undefined;
    }
  }

  colors[property] = result;
  return result;
}

export function ChartView(props: {
  type: ChartViewType,
  options?: DeepPartial<ChartOptions>,
  priceRef?: RefObject<SeriesApiRef<'Candlestick' | 'Bar' | 'Area' | 'Line'> | null>,
  priceData: PriceBar[],
  volumeRef?: RefObject<SeriesApiRef<'Histogram'> | null>,
  volumeData: VolumeBar[],
  onInit?: (chart: IChartApi) => void,
  onCrosshairMove?: MouseEventHandler<Time>
  onVisibleLogicalRangeChange?: LogicalRangeChangeEventHandler
}) {
  const onCrosshairMove = useCallback((e: MouseEventParams) => {
    const logical = e.logical?.toString() || '';
    if (!props.onCrosshairMove || crosshairLogical == logical)
      return;
    
    crosshairLogical = logical;
    if (crosshairTimeout != null)
      clearTimeout(crosshairTimeout);

    crosshairTimeout = setTimeout(() => {
      if (props.onCrosshairMove)
        props.onCrosshairMove(e);
      crosshairTimeout = null;
    }, 50) as any;
  }, [props.onCrosshairMove]);
  const mobile = document.body.clientWidth <= 800;
  const priceScaleActive = !mobile || props.type == ChartViewType.Candles || props.type == ChartViewType.Bars;
  const priceLine = { priceLineVisible: priceScaleActive, lastValueVisible: priceScaleActive };
  return (
    <Chart options={props.options} onInit={props.onInit} onCrosshairMove={onCrosshairMove}>
      {
        props.type == ChartViewType.Candles &&
        <CandlestickSeries ref={props.priceRef as any} data={props.priceData} options={{
          upColor: UP_COLOR,
          wickUpColor: UP_COLOR,
          borderUpColor: UP_COLOR,
          downColor: DOWN_COLOR,
          wickDownColor: DOWN_COLOR,
          borderDownColor: DOWN_COLOR,
          ...priceLine
        }} />
      }
      {
        props.type == ChartViewType.Bars &&
        <BarSeries ref={props.priceRef as any} data={props.priceData} options={{
          upColor: UP_COLOR,
          downColor: DOWN_COLOR,
          ...priceLine
        }}  />
      }
      {
        props.type == ChartViewType.Mountain &&
        <AreaSeries ref={props.priceRef as any} data={props.priceData} options={{
          lineColor: colorOf('--accent-10'),
          topColor: colorOf('--accent-a4'),
          bottomColor: colorOf('--accent-a1'),
          ...priceLine
        }} />
      }
      {
        props.type == ChartViewType.Line &&
        <LineSeries ref={props.priceRef as any} data={props.priceData} options={{
          color: colorOf('--accent-a10'),
          ...priceLine
        }} />
      }
      {
        props.volumeRef &&
        <HistogramSeries ref={props.volumeRef} data={props.volumeData} options={{
          priceScaleId: '',
          priceFormat: { type: 'volume' }
        }} />
      }
      <TimeScale onVisibleLogicalRangeChange={props.onVisibleLogicalRangeChange}>
        <TimeScaleFitContentTrigger deps={[]} />
      </TimeScale>
    </Chart>
  );
}
export function ChartTitle({
  orderbook,
  pair,
  whitelisted,
}: {
  orderbook: { marketId: BigNumber | null, primaryAsset: AssetId | null, secondaryAsset: AssetId | null } | null,
  pair: AggregatedPair | null,
  whitelisted: boolean | null
}) {
  const close = pair?.price.close || null;
  const delta = close ? close.minus(pair?.price.open || new BigNumber(0)) : null;
  const dir = delta && delta.gt(0) ? 1 : (delta && delta.lt(0) ? -1 : 0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 2px 12px', borderBottom: '1px solid var(--line)', marginBottom: 10 }}>
      <span style={{ position: 'relative', width: 50, height: 50, flex: 'none' }}>
        <AssetImage asset={orderbook?.primaryAsset || undefined} size="3" iconSize="46px"></AssetImage>
        <AssetImage asset={orderbook?.secondaryAsset || undefined} size="2" iconSize="30px" style={{ position: 'absolute', bottom: -6, right: -6, border: '2px solid var(--card)', borderRadius: '50%' }}></AssetImage>
      </span>
      <div style={{ minWidth: 0 }}>
        <Tooltip content={whitelisted === true ? 'Well-known trading pair — current price is possibly within reasonable market ranges' : (whitelisted === false ? 'One or both of assets in trading pair are unknown and are possibly malicious — current price is likely not representative of actual market conditions' : 'Loading...')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontWeight: 750, fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ orderbook?.primaryAsset ? Assetlist.toName(orderbook.primaryAsset) : '?' }</span>
            { whitelisted === true && <Icon className="verified" path={mdiCheckDecagram} size={0.8}></Icon> }
            { whitelisted === false && <Icon path={mdiAlert} color="var(--warn)" size={0.8} style={{ flex: 'none' }}></Icon> }
            { whitelisted == null && <Icon path={mdiTimelapse} color="var(--text-3)" size={0.8} style={{ flex: 'none' }}></Icon> }
          </div>
        </Tooltip>
        <div className="mono dim" style={{ marginTop: 2, whiteSpace: 'nowrap', fontSize: 12.5 }}>{ (orderbook?.primaryAsset ? UiUtil.toAssetSymbol(orderbook.primaryAsset) : '?') + ' × ' + (orderbook?.secondaryAsset ? UiUtil.toAssetSymbol(orderbook.secondaryAsset) : '?') }</div>
      </div>
      <div style={{ marginLeft: 'auto', textAlign: 'right', minWidth: 0 }}>
        <div className="num" style={{ fontWeight: 800, fontSize: 21, color: dir > 0 ? 'var(--lime)' : (dir < 0 ? 'var(--down)' : 'var(--text)'), whiteSpace: 'nowrap' }}>{ UiUtil.toValue(null, close, false, true) }</div>
        <div className="ob-delta-row" style={{ justifyContent: 'flex-end', marginTop: 3 }}>
          <span className={ 'abs' + (dir != 0 ? (dir > 0 ? ' up' : ' down') : '') }>{ (dir > 0 ? '+' : (dir < 0 ? '-' : '')) + UiUtil.toValue(null, delta ? delta.abs() : new BigNumber(0), false, true) }</span>
          <span className={ 'ob-delta-pill' + (dir > 0 ? ' up' : (dir == 0 ? ' flat' : '')) }>
            { dir != 0 && <Icon path={dir > 0 ? mdiArrowUpBold : mdiArrowDownBold} size={0.55}></Icon> }
            { UiUtil.toPercentageDelta(pair?.price.open || new BigNumber(0), close || new BigNumber(0)) }
          </span>
        </div>
      </div>
    </div>
  )
}
export function ChartWidget({
  orderbook,
  pair,
  whitelisted,
  options,
  tradeEvents,
  onOptionsChange,
  onTradesChange,
  onPairChange,
  onScrub,
  bare
}: ChartProps) {
  const mobile = document.body.clientWidth <= 800;
  const frameRef = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<IChartApi>(null);
  const priceSeriesRef = useRef<SeriesApiRef<'Candlestick' | 'Bar' | 'Area' | 'Line'>>(null);
  const volumeSeriesRef = useRef<SeriesApiRef<'Histogram'>>(null);
  const [legendBar, setLegendBar] = useState<{ price?: PriceBar | null, volume?: VolumeBar | null }>({ });
  const [state, setState] = useState({
    launch: Number.MIN_SAFE_INTEGER,
    from: Number.MAX_SAFE_INTEGER,
    to: Number.MIN_SAFE_INTEGER,
    ready: false,
    loading: false
  });
  const [series, setSeries] = useState<{ price: PriceBar[], volume: VolumeBar[] }>({
    price: [],
    volume: []
  });
  const interval = useMemo((): string => {
    const target = options.intervals.find((item) => item[0] == options.interval);
    return target ? target[1].toString() : '?';
  }, [options.intervals, options.interval]);
  const chartOptions = useMemo((): DeepPartial<ChartOptions> => {
    return {
      crosshair: {
        mode: options.crosshair,
        horzLine: {
          labelBackgroundColor: colorOf('--accent-3'),
        },
        vertLine: {
          labelBackgroundColor: colorOf('--accent-3')
        }
      },
      layout: {
          background: { color: 'transparent' },
          textColor: colorOf('--gray-12')
      },
      grid: {
        vertLines: { color: colorOf('--gray-5'), visible: options.view == ChartViewType.Candles || options.view == ChartViewType.Bars },
        horzLines: { color: colorOf('--gray-5'), visible: options.view == ChartViewType.Candles || options.view == ChartViewType.Bars }
      },
      rightPriceScale: {
        visible: !mobile || options.view == ChartViewType.Candles || options.view == ChartViewType.Bars,
        borderColor: colorOf('--gray-5'),
        autoScale: true,
        ticksVisible: true,
        invertScale: options.inverted,
        mode: options.price
      },
      timeScale: {
        borderColor: colorOf('--gray-5'),
        timeVisible: true,
        secondsVisible: true
      },
      localization: {
          priceFormatter: (price: BarPrice): string => UiUtil.toValue(null, price, false, true)
      }
    };
  }, [pair?.id, options.crosshair, options.view, options.inverted, options.price, mobile]);
  const fetchSeries = useCallback(async (range: LogicalRange | null) => {
    if (!pair || !priceSeriesRef.current || state.loading)
      return;

    if (state.ready) {
      if (state.from <= state.launch)
        return;

      const bars = range != null ? priceSeriesRef.current.api()?.barsInLogicalRange(range) || null : null;
      if (!bars || bars.barsBefore > 0)
        return;
    }
    
    const to = upperTimeSlot(options.interval, state.ready && state.from != Number.MAX_SAFE_INTEGER ? state.from : Math.floor(new Date().getTime() / 1000));
    const from = Math.max(state.launch, lowerTimeSlot(options.interval, to - options.bars * options.interval));
    if (isNaN(from) || isNaN(to) || to <= from)
      return;
    else if (state.ready && from >= state.from && to <= state.to)
      return;
      
    const reset = !state.ready;
    setState(prev => ({ ...prev, loading: true }));
    try {
      const result = await Exchange.marketPairPriceSeries(pair.id, options.interval, Math.floor(from / options.interval));
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
          color: bar.open.lte(bar.close) ? UP_VCOLOR : DOWN_VCOLOR
        });
        min = Math.min(min, time as any);
        max = Math.max(max, time as any);
      }
      
      priceSeriesRef.current?.api()?.setData([]);
      volumeSeriesRef.current?.api()?.setData([]);
      setSeries(prev => ({
        price: reset ? price : mergePriceSeries(prev.price, price),
        volume: reset ? volume : mergeVolumeSeries(prev.volume, volume)
      }));
      setTimeout(() => setState(prev => ({
        ...prev,
        ready: true,
        loading: false,
        from: reset ? min : Math.min(min, prev.from, from),
        to: reset ? max : Math.max(max, prev.to)
      })), 500);
    } catch {
      setState(prev => ({ ...prev, ready: true, loading: false, from: Number.MIN_SAFE_INTEGER }));
    }
  }, [pair, state, options.bars, options.interval]);
  const fitChart = useCallback((api?: IChartApi) => {
    if (api != null) {
      seriesRef.current = api;
    }

    const box = frameRef.current;
    if (box != null && seriesRef.current != null) {
      seriesRef.current.resize(box.clientWidth, box.clientHeight);
    }
    
    if (options.volume) {
      const fitVolume = () => {
        const volumeSeriesApi = volumeSeriesRef.current?.api();
        volumeSeriesApi?.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
        if (!volumeSeriesApi)
          setTimeout(fitVolume, 50);
      };
      fitVolume();
    }
  }, [options.volume]);
  const fitLegend = useCallback((event: MouseEventParams) => {
    const priceSeriesApi = priceSeriesRef.current?.api();
    const priceBar = event && priceSeriesApi ? event.seriesData.get(priceSeriesApi) as PriceBar : undefined;
    if (onScrub) {
      const close = priceBar ? (priceBar as PriceBar).close ?? (priceBar as unknown as VolumeBar).value : undefined;
      onScrub(event?.time != null && close != null && Number.isFinite(close) ? new BigNumber(close) : null);
      return;
    }
    const volumeSeriesApi = volumeSeriesRef.current?.api();
    const volumeBar = event && volumeSeriesApi ? event.seriesData.get(volumeSeriesApi) as VolumeBar : undefined;
    if (priceBar || volumeBar)
      setLegendBar({ price: priceBar, volume: volumeBar });
  }, [onScrub]);
  useEffectAsync(async () => {
    if (!state.ready && priceSeriesRef.current) {
      await fetchSeries(null);
    }
  }, [state.ready, priceSeriesRef.current, fetchSeries]);
  useEffect(() => {
    if (!pair || !state.ready || !tradeEvents.length)
      return;

    const trades: AggregatedLog[] = [];
    const target = Exchange.priceOf(pair.primaryAsset, pair.secondaryAsset);
    let price = target.close, quantity = new BigNumber(0);
    for (let i = 0; i < tradeEvents.length; i++) {
      const data = tradeEvents[i].detail || null;
      const merge = data?.primaryAsset?.id == pair?.primaryAsset.id && data?.secondaryAsset?.id == pair?.secondaryAsset.id;
      const nextAccount = data?.account || null;
      const nextSide = (data?.side || OrderSide.Buy) as OrderSide;
      const nextPrice = merge && data?.price ? new BigNumber(data?.price || 0) : null;
      const nextQuantity = merge ? new BigNumber(data?.quantity || 0) : new BigNumber(0);
      if (merge && nextPrice != null) {
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
    
    onTradesChange(trades);
    if (!price)
      return;

    onPairChange({
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
    setSeries(prev => {
      if (!price)
        return prev;
      
      const priceSeries = [...prev.price], volumeSeries = [...prev.volume];
      const time = lowerTimeSlot(options.interval, Math.floor(new Date().getTime() / 1000)); 
      const prevPrice: PriceBar | null = priceSeries.length > 0 ? priceSeries[priceSeries.length - 1] : null;
      const prevVolume: VolumeBar | null = volumeSeries.length > 0 ? volumeSeries[volumeSeries.length - 1] : null;
      const mergePrice = prevPrice && (prevPrice.time as number) >= time;
      const mergeVolume = prevVolume && (prevVolume.time as number) >= time;
      const nextPrice: PriceBar = {
          time: mergePrice ? prevPrice.time : time as Time,
          open: mergePrice ? prevPrice.open : price.toNumber(),
          low: mergePrice ? Math.min(prevPrice.low, price.toNumber()) : price.toNumber(),
          high: mergePrice ? Math.max(prevPrice.high, price.toNumber()) : price.toNumber(),
          close: price.toNumber(),
          value: price.toNumber()
      };
      const nextVolume: VolumeBar = {
        time: mergeVolume ? prevVolume.time : time as Time,
        value: mergeVolume ? prevVolume.value + quantity.toNumber() : quantity.toNumber(),
        color: mergeVolume && prevVolume.value * 0.5 >= quantity.toNumber() ? prevVolume.color : (nextPrice.open <= nextPrice.close ? UP_VCOLOR : DOWN_VCOLOR)
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
  }, [tradeEvents, pair, state.ready, options.interval, onTradesChange, onPairChange]);
  useEffect(() => {
    if (!frameRef.current)
      return;
    const observer = new ResizeObserver(() => fitChart());
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, [fitChart]);

  return (
    <Box width="100%" className={bare ? 'chart-bare' : 'card'} style={{ padding: bare ? 0 : '14px 14px 12px', marginBottom: mobile ? 14 : 12 }}>
      { !mobile && <ChartTitle orderbook={orderbook} pair={pair} whitelisted={whitelisted}></ChartTitle> }
      <div ref={frameRef} className={bare ? 'chart-bleed' : undefined} style={{ position: 'relative', height: mobile ? 'max(300px, 50vh)' : 660 }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <ChartView
            type={options.view}
            options={chartOptions}
            priceRef={priceSeriesRef}
            priceData={series.price}
            volumeRef={options.volume ? volumeSeriesRef : undefined}
            volumeData={series.volume}
            onInit={(api) => fitChart(api)}
            onCrosshairMove={(e) => fitLegend(e)}
            onVisibleLogicalRangeChange={fetchSeries}></ChartView>
          { !mobile && <Box position="absolute" top="0" left="0" pl="3" pt="2" style={bare ? { zIndex: 1, paddingInlineStart: 'var(--shell-pad)' } : { zIndex: 1 }}>
            {
              orderbook?.primaryAsset && orderbook?.secondaryAsset &&
              <Text>{ UiUtil.toAssetSymbol(orderbook.primaryAsset) }/{ UiUtil.toAssetSymbol(orderbook.secondaryAsset) } { interval }</Text>
            }
            {
              !mobile && (options.view == ChartViewType.Bars || options.view == ChartViewType.Candles ?
              <Flex direction="column">
                <Text size="1"><Text color="gray" mr="1">O</Text>{ UiUtil.toMoney(orderbook?.secondaryAsset || null, legendBar.price?.open || null) }</Text>
                <Text size="1"><Text color="gray" mr="1">H</Text>{ UiUtil.toMoney(orderbook?.secondaryAsset || null, legendBar.price?.high || null) }</Text>
                <Text size="1"><Text color="gray" mr="1">L</Text>{ UiUtil.toMoney(orderbook?.secondaryAsset || null, legendBar.price?.low || null) }</Text>
                <Text size="1"><Text color="gray" mr="1">C</Text>{ UiUtil.toMoney(orderbook?.secondaryAsset || null, legendBar.price?.close || null) }</Text>
                { options.volume && <Text size="1"><Text color="gray" mr="1">V</Text>{ UiUtil.toMoney(orderbook?.primaryAsset || null, legendBar.volume?.value || null) }</Text> }
              </Flex> :
              <Flex direction="column">
                <Text size="1"><Text color="gray" mr="1">C</Text>{ UiUtil.toMoney(orderbook?.secondaryAsset || null, legendBar.price?.value || null) }</Text>
                { options.volume && <Text size="1"><Text color="gray" mr="1">V</Text>{ UiUtil.toMoney(orderbook?.primaryAsset || null, legendBar.volume?.value || null) }</Text> }
              </Flex>)
            }
          </Box> }
        </div>
      </div>
      <div className="chart-foot">
        <Tabs.Root className="range-tabs" value={ String(options.interval) } onValueChange={(v) => {
          onOptionsChange(prev => ({ ...prev, interval: parseInt(v) }));
          setState(prev => ({ ...prev, ready: false }));
        }}>
          <Tabs.List size="1">
            {
              ([
                [1800, '30m'],
                [3600, '1h'],
                [14400, '4h'],
                [86400, '1d'],
                [604800, '1w']
              ] as [number, string][]).map(([value, label]) =>
                <Tabs.Trigger key={value} value={ String(value) }>{ label }</Tabs.Trigger>)
            }
          </Tabs.List>
        </Tabs.Root>
        {
          !mobile && ![1800, 3600, 14400, 86400, 604800].includes(options.interval) &&
          <span className="badge flat mono">{ interval }</span>
        }
        <div className="chart-foot-side">
          {
            !mobile &&
            <>
              <span className="chart-foot-next">NEXT BLOCK</span>
              <Clock></Clock>
              <span className="chart-foot-div"></span>
            </>
          }
          <Dialog.Root>
            <Dialog.Trigger>
              <button className="icon-btn" aria-label="Chart settings"><Icon path={mdiCog} size={0.9}></Icon></button>
            </Dialog.Trigger>
            <Dialog.Content maxWidth="450px">
              <Dialog.Title>Configure</Dialog.Title>
              <Flex direction="column" gap="2">
                <Select.Root value={options.interval.toString()} onValueChange={(e) => {
                  onOptionsChange(prev => ({ ...prev, interval: parseInt(e) }));
                  setState(prev => ({ ...prev, ready: false }));
                }}>
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Group>
                      <Select.Label>Interval</Select.Label>
                      {
                        options.intervals.map((item) =>
                          <Select.Item key={item[0]} value={item[0].toString()}>{ item[1] } interval</Select.Item>)
                      }
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
                <Select.Root value={options.view.toString()} onValueChange={(e) => onOptionsChange(prev => ({ ...prev, view: parseInt(e) }))}>
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
                <Select.Root value={options.inverted ? '1' : '0'} onValueChange={(e) => onOptionsChange(prev => ({ ...prev, inverted: parseInt(e) > 0 }))}>
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Group>
                      <Select.Label>Price view</Select.Label>
                      <Select.Item value="0">Normal price</Select.Item>
                      <Select.Item value="1">Inverted price</Select.Item>
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
                <Select.Root value={options.price.toString()} onValueChange={(e) => onOptionsChange(prev => ({ ...prev, price: parseInt(e) }))}>
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
                <Select.Root value={options.volume ? '1' : '0'} onValueChange={(e) => onOptionsChange(prev => ({ ...prev, volume: parseInt(e) > 0 }))}>
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Group>
                      <Select.Label>Volume data</Select.Label>
                      <Select.Item value="0">Volume hidden</Select.Item>
                      <Select.Item value="1">Volume shown</Select.Item>
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
                <Select.Root value={options.crosshair.toString()} onValueChange={(e) => onOptionsChange(prev => ({ ...prev, crosshair: parseInt(e) }))}>
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
              </Flex>
            </Dialog.Content>
            </Dialog.Root>
        </div>
      </div>
    </Box>
  );
}