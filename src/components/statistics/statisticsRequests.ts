import type {
  StatisticsDistributionItem,
  StatisticsHeatmapPoint,
  StatisticsListeningTimeItem,
  StatisticsTimeSeriesPoint,
  StatisticsTopItemResult,
} from "@/plugins/api/interfaces";

export interface StatisticsChartData {
  artistDistribution: StatisticsTopItemResult[];
  playsOverTime: StatisticsTimeSeriesPoint[];
  listeningActivity: StatisticsHeatmapPoint[];
  listeningTime: StatisticsListeningTimeItem[];
  decadeDistribution: StatisticsDistributionItem[];
}

export interface StatisticsChartRequests {
  artistDistribution: Promise<StatisticsTopItemResult[]>;
  playsOverTime: Promise<StatisticsTimeSeriesPoint[]>;
  listeningActivity: Promise<StatisticsHeatmapPoint[]>;
  listeningTime: Promise<StatisticsListeningTimeItem[]>;
  decadeDistribution: Promise<StatisticsDistributionItem[]>;
}

export function getPlaysOverTimeGranularity(
  period: string,
): "hour" | "day" | "month" {
  if (period === "today") return "hour";
  return period === "all_time" ? "month" : "day";
}

export function formatPlaysOverTimeLabel(
  timestamp: string,
  period: string,
): string {
  if (period !== "today") return timestamp;
  const time = timestamp.split(" ")[1];
  return time ? time.slice(0, 5) : timestamp;
}

const PERIOD_LENGTH_DAYS: Partial<Record<string, number>> = {
  week: 7,
  month: 30,
  year: 365,
};
const MAX_ALL_TIME_MONTHLY_BUCKETS = 60;

export function fillPlaysOverTimeGaps(
  points: StatisticsTimeSeriesPoint[],
  period: string,
  now = new Date(),
): StatisticsTimeSeriesPoint[] {
  if (points.length === 0) return [];

  const sourceGranularity =
    period === "today" ? "hour" : period === "all_time" ? "month" : "day";
  const sortedPoints = [...points].sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
  const firstSourceBucket = parsePlayBucket(
    sortedPoints[0].timestamp,
    sourceGranularity,
  );
  if (!firstSourceBucket) return sortedPoints;

  const granularity =
    period === "all_time" &&
    getBucketCount(firstSourceBucket, startOfBucket(now, "month"), "month") >
      MAX_ALL_TIME_MONTHLY_BUCKETS
      ? "year"
      : sourceGranularity;
  const bucketPoints =
    granularity === "year"
      ? aggregateMonthlyPointsByYear(sortedPoints)
      : sortedPoints;
  const firstBucket = parsePlayBucket(bucketPoints[0].timestamp, granularity);
  if (!firstBucket) return sortedPoints;

  const periodLength = PERIOD_LENGTH_DAYS[period];
  if (
    period !== "today" &&
    period !== "all_time" &&
    periodLength === undefined
  ) {
    return sortedPoints;
  }

  const start =
    period === "all_time"
      ? firstBucket
      : period === "today"
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : startOfBucket(
            new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate() - periodLength!,
            ),
            granularity,
          );
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

function parsePlayBucket(
  timestamp: string,
  granularity: "hour" | "day" | "month" | "year",
): Date | undefined {
  const pattern =
    granularity === "year"
      ? /^(\d{4})$/
      : granularity === "month"
        ? /^(\d{4})-(\d{2})$/
        : /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):\d{2}:\d{2})?$/;
  const match = pattern.exec(timestamp);
  if (!match) return undefined;
  return new Date(
    Number(match[1]),
    granularity === "year" ? 0 : Number(match[2]) - 1,
    granularity === "year" || granularity === "month" ? 1 : Number(match[3]),
    granularity === "hour" ? Number(match[4] ?? 0) : 0,
  );
}

function startOfBucket(
  date: Date,
  granularity: "hour" | "day" | "month" | "year",
): Date {
  const result = new Date(date);
  if (granularity === "hour") result.setMinutes(0, 0, 0);
  else {
    result.setHours(0, 0, 0, 0);
    if (granularity === "month" || granularity === "year") result.setDate(1);
    if (granularity === "year") result.setMonth(0);
  }
  return result;
}

function getBucketCount(start: Date, end: Date, granularity: "month"): number {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
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

function formatPlayBucket(
  date: Date,
  granularity: "hour" | "day" | "month" | "year",
): string {
  if (granularity === "year") return date.getFullYear().toString();
  const datePart = [
    date.getFullYear().toString().padStart(4, "0"),
    (date.getMonth() + 1).toString().padStart(2, "0"),
    date.getDate().toString().padStart(2, "0"),
  ].join("-");
  if (granularity === "month") return datePart.slice(0, 7);
  if (granularity === "day") return datePart;
  return `${datePart} ${date.getHours().toString().padStart(2, "0")}:00:00`;
}

export function createLatestRequestGate() {
  let generation = 0;

  return {
    begin: () => ++generation,
    isCurrent: (requestGeneration: number) => requestGeneration === generation,
    invalidate: () => {
      generation++;
    },
  };
}

export async function loadStatisticsChartData(
  requests: StatisticsChartRequests,
): Promise<{ data: StatisticsChartData; hasFailures: boolean }> {
  const results = await Promise.allSettled([
    requests.artistDistribution,
    requests.playsOverTime,
    requests.listeningActivity,
    requests.listeningTime,
    requests.decadeDistribution,
  ]);
  const [
    artistDistribution,
    playsOverTime,
    listeningActivity,
    listeningTime,
    decadeDistribution,
  ] = results;

  return {
    data: {
      artistDistribution:
        artistDistribution.status === "fulfilled"
          ? artistDistribution.value
          : [],
      playsOverTime:
        playsOverTime.status === "fulfilled" ? playsOverTime.value : [],
      listeningActivity:
        listeningActivity.status === "fulfilled" ? listeningActivity.value : [],
      listeningTime:
        listeningTime.status === "fulfilled" ? listeningTime.value : [],
      decadeDistribution:
        decadeDistribution.status === "fulfilled"
          ? decadeDistribution.value
          : [],
    },
    hasFailures: results.some((result) => result.status === "rejected"),
  };
}
