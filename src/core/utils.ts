import { AssetId } from "tangentsdk/algorithm";
import { UiUtil } from "tangentsdk/ui";
import BigNumber from "bignumber.js";

export function secondsToDuration(baseSeconds: number, short?: boolean): string {
  if (!baseSeconds)
    return "0 seconds";

  const SEC_PER_MIN = 60.0;
  const SEC_PER_HOUR = 60.0 * SEC_PER_MIN;
  const SEC_PER_DAY = 24.0 * SEC_PER_HOUR;
  const SEC_PER_WEEK = 7.0 * SEC_PER_DAY;
  const SEC_PER_MONTH = (365.2425 / 12.0) * SEC_PER_DAY;
  const SEC_PER_YEAR = 365.2425 * SEC_PER_DAY;
  const toDuration = (value: number, duration: string): string => `${Math.round(value)}${short ? duration : (' ' + duration)}${!short && value > 1 ? "s" : ""}`;
  const seconds = Math.round(baseSeconds);
  if (seconds >= SEC_PER_YEAR)
    return toDuration(seconds / SEC_PER_YEAR, short ? "y" : "year");
  else if (seconds >= SEC_PER_MONTH)
    return toDuration(seconds / SEC_PER_MONTH, short ? "M" : "month");
  else if (seconds >= SEC_PER_WEEK)
    return toDuration(seconds / SEC_PER_WEEK, short ? "w" : "week");
  else if (seconds >= SEC_PER_DAY)
    return toDuration(seconds / SEC_PER_DAY, short ? "d" : "day");
  else if (seconds >= SEC_PER_HOUR)
    return toDuration(seconds / SEC_PER_HOUR, short ? "h" : "hour");
  else if (seconds >= SEC_PER_MIN)
    return toDuration(seconds / SEC_PER_MIN, short ? "m" : "minute");
  return toDuration(seconds, short ? "s" : "second");
}
export function toFancyPrecision(value: string | number | BigNumber | null): BigNumber | null {
  let numeric: BigNumber | null = value ? new BigNumber(BigNumber.isBigNumber(value) ? value.toPrecision(12) : value) : null;
  if (numeric) {
    const test = numeric.abs();
    if (test.gte(100))
      numeric = numeric.decimalPlaces(2);
    else if (test.gte(10))
      numeric = numeric.decimalPlaces(3);
    else if (test.gte(1))
      numeric = numeric.decimalPlaces(4);
  }
  return numeric;
}
export function toFancyValue(asset: AssetId | null, value: string | number | BigNumber | null, delta: boolean, trailing: boolean) {
  return UiUtil.toValue(asset, toFancyPrecision(value), delta, trailing);
}
export function toFancyMoney(asset: AssetId | null, value: string | number | BigNumber | null, delta?: boolean) {
  return UiUtil.toMoney(asset, toFancyPrecision(value), delta);
}