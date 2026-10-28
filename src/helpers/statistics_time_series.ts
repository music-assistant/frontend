import type {
  StatisticsGranularity,
  StatisticsPeriod,
  StatisticsTimeSeriesPoint,
} from "@/plugins/api/interfaces";

/** The size of one plays-over-time bucket once gaps are filled. */
export type PlayBucket = "hour" | "day" | "month" | "year";

/** Totals that can be derived from a gap-filled plays-over-time series. */
export interface PlaysSummary {
  total: number;
  // plays per bucket, over every bucket of the period
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
const MONTHS_PER_YEAR = 12;

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
 * Fills the buckets the server leaves out because nothing was played in them,
 * so the chart and the averages cover the whole period. A long all-time
 * history is summed into years.
 */
export function fillPlaysOverTimeGaps(
  points: StatisticsTimeSeriesPoint[],
  period: StatisticsPeriod,
  now = new Date(),
): StatisticsTimeSeriesPoint[] {
  if (points.length === 0) return [];

  const sortedPoints = [...points].sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
  const firstSourceBucket = parsePlayBucket(sortedPoints[0].timestamp);
  if (!firstSourceBucket) return sortedPoints;

  const sourceGranularity = getPlaysOverTimeGranularity(period) as PlayBucket;
  const granularity: PlayBucket =
    period === "all_time" &&
    countMonths(firstSourceBucket, startOfBucket(now, "month")) >
      MAX_ALL_TIME_MONTHLY_BUCKETS
      ? "year"
      : sourceGranularity;
  const bucketPoints =
    granularity === "year"
      ? aggregateMonthlyPointsByYear(sortedPoints)
      : sortedPoints;
  const firstBucket = parsePlayBucket(bucketPoints[0].timestamp);
  if (!firstBucket) return sortedPoints;

  let start: Date;
  if (period === "all_time") start = firstBucket;
  else if (period === "today") start = startOfBucket(now, "day");
  else {
    start = startOfBucket(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - (PERIOD_LENGTH_DAYS[period] ?? 0),
      ),
      granularity,
    );
  }
  const end = startOfBucket(now, granularity);
  const pointsByBucket = new Map(
    bucketPoints.map((point) => [point.timestamp, point.value]),
  );
  const filledPoints: StatisticsTimeSeriesPoint[] = [];
  const bucket = new Date(start);

  while (bucket <= end) {
    const timestamp = formatPlayBucket(bucket, granularity);
    filledPoints.push({
      timestamp,
      value: pointsByBucket.get(timestamp) ?? 0,
    });
    if (granularity === "hour") bucket.setHours(bucket.getHours() + 1);
    else if (granularity === "day") bucket.setDate(bucket.getDate() + 1);
    else if (granularity === "month") bucket.setMonth(bucket.getMonth() + 1);
    else bucket.setFullYear(bucket.getFullYear() + 1);
  }

  return filledPoints;
}

/** Total, per-bucket average and busiest bucket of a gap-filled series. */
export function summarizePlays(
  points: StatisticsTimeSeriesPoint[],
): PlaysSummary {
  let total = 0;
  let busiest: StatisticsTimeSeriesPoint | undefined;
  for (const point of points) {
    total += point.value;
    if (point.value > 0 && (!busiest || point.value > busiest.value)) {
      busiest = point;
    }
  }
  return {
    total,
    average: points.length > 0 ? total / points.length : 0,
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

function startOfBucket(date: Date, granularity: PlayBucket): Date {
  const result = new Date(date);
  if (granularity === "hour") {
    result.setMinutes(0, 0, 0);
    return result;
  }
  result.setHours(0, 0, 0, 0);
  if (granularity === "month" || granularity === "year") result.setDate(1);
  if (granularity === "year") result.setMonth(0);
  return result;
}

function countMonths(start: Date, end: Date): number {
  return (
    (end.getFullYear() - start.getFullYear()) * MONTHS_PER_YEAR +
    end.getMonth() -
    start.getMonth() +
    1
  );
}

function aggregateMonthlyPointsByYear(
  points: StatisticsTimeSeriesPoint[],
): StatisticsTimeSeriesPoint[] {
  const valuesByYear = new Map<string, number>();
  for (const point of points) {
    const year = point.timestamp.slice(0, 4);
    valuesByYear.set(year, (valuesByYear.get(year) ?? 0) + point.value);
  }
  return Array.from(valuesByYear, ([timestamp, value]) => ({
    timestamp,
    value,
  })).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

function formatPlayBucket(date: Date, granularity: PlayBucket): string {
  const year = date.getFullYear().toString().padStart(4, "0");
  if (granularity === "year") return year;
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  if (granularity === "month") return `${year}-${month}`;
  const day = `${year}-${month}-${date.getDate().toString().padStart(2, "0")}`;
  if (granularity === "day") return day;
  return `${day} ${date.getHours().toString().padStart(2, "0")}:00:00`;
}
