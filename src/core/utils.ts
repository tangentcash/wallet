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