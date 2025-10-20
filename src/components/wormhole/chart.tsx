import { ChartOptions, DeepPartial, IChartApi, LogicalRangeChangeEventHandler, MouseEventHandler, Time } from "lightweight-charts";
import { AreaSeries, BarSeries, CandlestickSeries, Chart, HistogramSeries, LineSeries, SeriesApiRef, TimeScale, TimeScaleFitContentTrigger } from "lightweight-charts-react-components";
import { RefObject } from "react";
import { AppData } from "../../core/app";

export type GenericBar = { time: Time };
export type PriceBar = GenericBar & { open: number, low: number, high: number, close: number, value: number };
export type VolumeBar = GenericBar & { value: number, color: string };

export enum ChartViewType {
  Candles,
  Bars,
  Mountain,
  Line
}

let crosshairTrackingTimeout: number | null = null;

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
  return (
    <Chart options={props.options} onInit={props.onInit} onCrosshairMove={props.onCrosshairMove ? ((e) => {
      if (crosshairTrackingTimeout != null)
        clearTimeout(crosshairTrackingTimeout);
      crosshairTrackingTimeout = setTimeout(() => {
        if (props.onCrosshairMove)
          props.onCrosshairMove(e);
        crosshairTrackingTimeout = null;
      }, 10) as any;
    }) : undefined }>
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