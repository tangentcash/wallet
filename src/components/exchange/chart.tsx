import { AspectRatio, Badge, Box, Dialog, Flex, IconButton, Select, Text, Tooltip } from "@radix-ui/themes";
import { AppData } from "../../core/app";
import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Exchange, AggregatedMatch, AggregatedPair, OrderSide } from "../../core/exchange";
import { useEffectAsync } from "../../core/react";
import { AreaSeries, BarSeries, CandlestickSeries, Chart, HistogramSeries, LineSeries, TimeScale, TimeScaleFitContentTrigger, SeriesApiRef } from "lightweight-charts-react-components";
import { LogicalRangeChangeEventHandler, MouseEventHandler, BarPrice, ChartOptions, CrosshairMode, DeepPartial, IChartApi, LogicalRange, MouseEventParams, PriceScaleMode, Time } from "lightweight-charts";
import { mdiAlert, mdiCheckDecagram, mdiCog, mdiCubeOutline, mdiTimelapse } from "@mdi/js";
import { AssetId, Readability } from "tangentsdk";
import { AssetImage } from "../../components/asset";
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";

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
  blockNumber: number,
  whitelisted: boolean | null,
  options: SeriesOptions,
  tradeEvents: CustomEvent<any>[],
  onOptionsChange: (callback: (prev: SeriesOptions) => SeriesOptions) => any,
  onTradesChange: (trades: AggregatedMatch[]) => any,
  onPairChange: (pair: AggregatedPair) => any
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

const UP_COLOR = '#22ab94';
const DOWN_COLOR = '#f7525f';
let crosshairTimeout: number | null = null;
let crosshairLogical: string | null = null;

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
    }, 10) as any;
  }, [props.onCrosshairMove]);
  return (
    <Chart options={props.options} onInit={props.onInit} onCrosshairMove={onCrosshairMove}>
      {
        props.type == ChartViewType.Candles &&
        <CandlestickSeries ref={props.priceRef as any} data={props.priceData} />
      }
      {
        props.type == ChartViewType.Bars &&
        <BarSeries ref={props.priceRef as any} data={props.priceData} />
      }
      {
        props.type == ChartViewType.Mountain &&
        <AreaSeries ref={props.priceRef as any} data={props.priceData} options={{
          lineColor: AppData.styleOf('--accent-a11'),
          topColor: AppData.styleOf('--accent-a3'),
          bottomColor: AppData.styleOf('--gray-2')
        }} />
      }
      {
        props.type == ChartViewType.Line &&
        <LineSeries ref={props.priceRef as any} data={props.priceData} options={{
          color: AppData.styleOf('--accent-a11')
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
export function ChartWidget({
  orderbook,
  pair,
  blockNumber,
  whitelisted,
  options,
  tradeEvents,
  onOptionsChange,
  onTradesChange,
  onPairChange
}: ChartProps) {
  const mobile = document.body.clientWidth <= 800;
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
        vertLines: { color: AppData.styleOf('--gray-5'), visible: options.view == ChartViewType.Candles || options.view == ChartViewType.Bars },
        horzLines: { color: AppData.styleOf('--gray-5'), visible: options.view == ChartViewType.Candles || options.view == ChartViewType.Bars }
      },
      rightPriceScale: {
        borderColor: AppData.styleOf('--gray-5'),
        autoScale: true,
        ticksVisible: true,
        invertScale: options.inverted,
        mode: options.price
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
  }, [pair?.id, options.crosshair, options.view, options.inverted, options.price]);
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
          color: bar.sentiment >= 0 ? UP_COLOR : DOWN_COLOR
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

    const box = seriesRef.current?.chartElement().parentElement?.parentElement;
    if (box != null) {
      seriesRef.current?.resize(box.clientWidth, box.clientHeight);
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
    const volumeSeriesApi = volumeSeriesRef.current?.api();
    const volumeBar = event && volumeSeriesApi ? event.seriesData.get(volumeSeriesApi) as VolumeBar : undefined;
    if (priceBar || volumeBar)
      setLegendBar({ price: priceBar, volume: volumeBar });
  }, []);
  useEffectAsync(async () => {
    if (!state.ready) {
      await fetchSeries(null);
    }
  }, [state.ready, fetchSeries]);
  useEffect(() => {
    setState(prev => ({
      ...prev,
      launch: pair ? Math.floor(pair.launchTime / 1000) : Number.MIN_SAFE_INTEGER,
      ready: false
    }));
  }, [pair?.id]);
  useEffect(() => {
    if (!pair || !state.ready || !tradeEvents.length)
      return;

    const trades: AggregatedMatch[] = [];
    const target = Exchange.priceOf(pair.primaryAsset, pair.secondaryAsset);
    let sentiment = 0, price = target.close, quantity = new BigNumber(0);
    for (let i = 0; i < tradeEvents.length; i++) {
      const data = tradeEvents[i].detail || null;
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
  }, [tradeEvents, pair, state.ready, options.interval, onTradesChange, onPairChange]);
  useEffect(() => {
    const resize = () => fitChart(); resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [options.volume]);

  return (
    <Box width="100%" mb={mobile ? undefined : '3'} style={mobile ? { } : { backgroundColor: 'var(--color-panel)', borderRadius: '22px', overflow: 'hidden' }}>
      <Flex align="center" pt={mobile ? '4' : '3'} pb={mobile ? '4' : '3'} px="3">
        <Box style={{ position: 'relative' }} mr="2">
          <AssetImage asset={orderbook?.secondaryAsset || undefined} size="2" style={{ position: 'absolute', top: mobile ? '18px' : '24px', left: '-6px' }}></AssetImage>
          <AssetImage asset={orderbook?.primaryAsset || undefined} size={mobile ? '3' : '4'}></AssetImage>
        </Box>
        <Flex direction="column" width="100%">
          <Flex justify="between">
            <Tooltip side="left" content={whitelisted === true ? 'Well-known trading pair — current price is possibly within reasonable market ranges' : (whitelisted === false ? 'One or both of assets in trading pair are unknown and are possibly malicious — current price is likely not representative of actual market conditions' : 'Loading...')}>
              <Flex gap="1">
                <Text size={mobile ? '3' : '4'} style={{ height: '18px', color: 'var(--gray-12)' }}>{ orderbook?.primaryAsset ? Readability.toAssetName(orderbook.primaryAsset) : '?' }</Text>
                { <Icon path={whitelisted === true ? mdiCheckDecagram : (whitelisted === false ? mdiAlert : mdiTimelapse)} color={whitelisted === true ? 'var(--sky-9)' : (whitelisted === false ? 'var(--yellow-9)' : 'var(--gray-9)')} size={0.75} style={{ transform: 'translateY(3px)' }}></Icon> }
              </Flex>
            </Tooltip>
            <Text size={mobile ? '3' : '4'} style={{ height: '18px' }}>{ Readability.toValue(null, pair?.price.close || null, false, true) }</Text>
          </Flex>
          <Flex justify="between" align="center" mt={mobile ? undefined : '1'}>
            <Text size={mobile ? '1' : '2'} color="gray">{ (orderbook?.primaryAsset ? Readability.toAssetSymbol(orderbook.primaryAsset) : '?') + 'x' + (orderbook?.secondaryAsset ? Readability.toAssetSymbol(orderbook.secondaryAsset) : '?') }</Text>
            <Box>
              <Text size={mobile ? '1' : '2'}>{ Readability.toValue(null, (pair?.price.close || new BigNumber(0)).minus(pair?.price.open || new BigNumber(0)), true, true) }</Text>
              <Text size={mobile ? '1' : '2'} color="gray"> | </Text>
              <Text size={mobile ? '1' : '2'} color={ (pair?.price.open || new BigNumber(0)).gt(pair?.price.close || new BigNumber(0)) ? 'red' : ((pair?.price.open || new BigNumber(0)).eq(pair?.price.close || new BigNumber(0)) ? undefined : 'lime') }>{ Readability.toPercentageDelta(pair?.price.open || new BigNumber(0), pair?.price.close || new BigNumber(0)) }</Text>
            </Box>
          </Flex>
        </Flex>
      </Flex>
      <AspectRatio ratio={mobile ? (7 / 9) : (16 / 9)}>
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
        <Box position="absolute" top="0" left="0" pl="3" pt="2" style={{ zIndex: 1 }}>
          {
            orderbook?.primaryAsset && orderbook?.secondaryAsset &&
            <Text>{ Readability.toAssetSymbol(orderbook.primaryAsset) }/{ Readability.toAssetSymbol(orderbook.secondaryAsset) } { interval }</Text>
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
      <Flex mt="2" px="3" pb="3" gap="2" justify="between" align="center">
        <Badge size="3" color="gray" style={{ fontSize: '1.05rem', padding: '10px 15px' }}>
          <Icon path={mdiCubeOutline} size={0.8}></Icon>
          { blockNumber > 0 && Readability.toValue(null, blockNumber, false, false) }
        </Badge>
        <Flex gap="2">
          <Select.Root size="3" value={options.interval.toString()} onValueChange={(e) => {
            onOptionsChange(prev => ({ ...prev, interval: parseInt(e) }));
            setState(prev => ({ ...prev, ready: false }));
          }}>
            <Select.Trigger variant="soft" color="gray" />
            <Select.Content>
              <Select.Group>
                <Select.Label>Interval</Select.Label>
                {
                  options.intervals.map((item) =>
                    <Select.Item key={item[0]} value={item[0].toString()}>{ item[1] }</Select.Item>)
                }
              </Select.Group>
            </Select.Content>
          </Select.Root>
          <Dialog.Root>
            <Dialog.Trigger>
              <IconButton size="3" variant="surface" color="gray" loading={state.loading}>
                <Icon path={mdiCog} size={0.95}></Icon>
              </IconButton>
            </Dialog.Trigger>
            <Dialog.Content maxWidth="450px">
              <Dialog.Title>Configure chart</Dialog.Title>
              <Flex direction="column" gap="2">
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
                {
                  !mobile &&
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
                }
              </Flex>
            </Dialog.Content>
          </Dialog.Root>
        </Flex>
      </Flex>
    </Box>
  );
}