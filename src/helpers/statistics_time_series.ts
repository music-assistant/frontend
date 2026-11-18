import type {
  StatisticsGranularity,
  StatisticsPeriod,
  StatisticsTimeSeriesPoint,
} from "@/plugins/api/interfaces";

/** The size of one plays-over-time bucket. */
export type PlayBucket = "hour" | "day" | "month" | "year";

/** Totals that can be derived from a plays-over-time series. */
export interface PlaysSummary {
  total: number;
  // plays per day for a rolling period, else per bucket
  average: number;
  // the bucket with the most plays; undefined when nothing was played
  busiest?: StatisticsTimeSeriesPoint;
}

// the server's rolling periods, in days
const PERIOD_LENGTH_DAYS: Partial<Record<StatisticsPeriod, number>> = {
  week: 7,
  month: 30,
  year: 365,
};
// all time switches from months to years once it spans more than five years
const MAX_ALL_TIME_MONTHLY_BUCKETS = 60;

const BUCKET_PATTERNS: Record<PlayBucket, RegExp> = {
  year: /^(\d{4})$/,
  month: /^(\d{4})-(\d{2})$/,
  day: /^(\d{4})-(\d{2})-(\d{2})$/,
  hour: /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):\d{2}:\d{2}$/,
};

/** The bucket size to request from `statistics/plays_over_time` for a period. */
export function getPlaysOverTimeGranularity(
  period: StatisticsPeriod,
): StatisticsGranularity {
  if (period === "today") return "hour";
  return period === "all_time" ? "month" : "day";
}

/** The bucket size a plays-over-time timestamp is written in. */
export function getPlayBucket(timestamp: string): PlayBucket | undefined {
  return (Object.keys(BUCKET_PATTERNS) as PlayBucket[]).find((bucket) =>
    BUCKET_PATTERNS[bucket].test(timestamp),
  );
}

/** The local start of a plays-over-time bucket. */
export function parsePlayBucket(timestamp: string): Date | undefined {
  const bucket = getPlayBucket(timestamp);
  if (!bucket) return undefined;
  const match = BUCKET_PATTERNS[bucket].exec(timestamp)!;
  return new Date(
    Number(match[1]),
    bucket === "year" ? 0 : Number(match[2]) - 1,
    bucket === "year" || bucket === "month" ? 1 : Number(match[3]),
    bucket === "hour" ? Number(match[4]) : 0,
  );
}

/**
 * Sums an all-time history of more than five years of months into years, so
 * the chart stays readable. The server already returns every bucket, empty
 * ones included.
 */
export function groupLongHistoryByYear(
  points: StatisticsTimeSeriesPoint[],
  period: StatisticsPeriod,
): StatisticsTimeSeriesPoint[] {
  if (period !== "all_time" || points.length <= MAX_ALL_TIME_MONTHLY_BUCKETS) {
    return points;
  }
  const valuesByYear = new Map<string, number>();
  for (const point of points) {
    const year = point.timestamp.slice(0, 4);
    valuesByYear.set(year, (valuesByYear.get(year) ?? 0) + point.value);
  }
  return Array.from(valuesByYear, ([timestamp, value]) => ({
    timestamp,
    value,
  }));
}

/**
 * Total, average and busiest bucket of a series. A rolling period
 * touches one more calendar day than it is long (8 for a week), so its
 * average is per day of the period rather than per bucket.
 */
export function summarizePlays(
  points: StatisticsTimeSeriesPoint[],
  period?: StatisticsPeriod,
): PlaysSummary {
  let total = 0;
  let busiest: StatisticsTimeSeriesPoint | undefined;
  for (const point of points) {
    total += point.value;
    if (point.value > 0 && (!busiest || point.value > busiest.value)) {
      busiest = point;
    }
  }
  const divisor =
    (period && PERIOD_LENGTH_DAYS[period]) ?? (points.length || undefined);
  return {
    total,
    average: points.length > 0 && divisor ? total / divisor : 0,
    busiest,
  };
}

/**
 * A short label for a bucket on the chart axis: the hour, the weekday (for a
 * week of days), the day and month, the month, or the year.
 */
export function formatBucketAxisLabel(
  timestamp: string,
  locale: string,
  preferWeekday = false,
): string {
  const bucket = getPlayBucket(timestamp);
  const date = parsePlayBucket(timestamp);
  if (!bucket || !date) return timestamp;
  const options: Record<PlayBucket, Intl.DateTimeFormatOptions> = {
    hour: { hour: "2-digit", minute: "2-digit" },
    day: preferWeekday
      ? { weekday: "short" }
      : { day: "numeric", month: "short" },
    month: { month: "short", year: "2-digit" },
    year: { year: "numeric" },
  };
  return new Intl.DateTimeFormat(locale, options[bucket]).format(date);
}

/** A full label for a bucket, for tooltips and sentences. */
export function formatBucketLabel(timestamp: string, locale: string): string {
  const bucket = getPlayBucket(timestamp);
  const date = parsePlayBucket(timestamp);
  if (!bucket || !date) return timestamp;
  const options: Record<PlayBucket, Intl.DateTimeFormatOptions> = {
    hour: { hour: "2-digit", minute: "2-digit" },
    day: { weekday: "long", day: "numeric", month: "long" },
    month: { month: "long", year: "numeric" },
    year: { year: "numeric" },
  };
  return new Intl.DateTimeFormat(locale, options[bucket]).format(date);
}

/**
 * Up to `maxCount` indices spread evenly over `length` items, always
 * including the first and last, for axis ticks on a long series.
 */
export function evenlySpacedIndices(
  length: number,
  maxCount: number,
): number[] {
  if (length <= 0 || maxCount <= 0) return [];
  if (length <= maxCount) return Array.from({ length }, (_, index) => index);
  if (maxCount === 1) return [0];
  const step = (length - 1) / (maxCount - 1);
  return Array.from({ length: maxCount }, (_, index) =>
    Math.round(index * step),
  );
}
