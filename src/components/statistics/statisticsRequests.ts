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

export function getPlaysOverTimeGranularity(period: string): "hour" | "day" {
  return period === "today" ? "hour" : "day";
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

export function fillPlaysOverTimeGaps(
  points: StatisticsTimeSeriesPoint[],
  period: string,
  now = new Date(),
): StatisticsTimeSeriesPoint[] {
  if (points.length === 0) return [];

  const hourly = period === "today";
  const sortedPoints = [...points].sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
  const firstBucket = parsePlayBucket(sortedPoints[0].timestamp, hourly);
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
            hourly,
          );
  const end = startOfBucket(now, hourly);
  const pointsByBucket = new Map(
    sortedPoints.map((point) => [point.timestamp, point.value]),
  );
  const filledPoints: StatisticsTimeSeriesPoint[] = [];
  const bucket = new Date(start);

  while (bucket <= end) {
    const timestamp = formatPlayBucket(bucket, hourly);
    filledPoints.push({
      timestamp,
      value: pointsByBucket.get(timestamp) ?? 0,
    });
    if (hourly) bucket.setHours(bucket.getHours() + 1);
    else bucket.setDate(bucket.getDate() + 1);
  }

  return filledPoints;
}

function parsePlayBucket(timestamp: string, hourly: boolean): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):\d{2}:\d{2})?$/.exec(
    timestamp,
  );
  if (!match) return undefined;
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    hourly ? Number(match[4] ?? 0) : 0,
  );
}

function startOfBucket(date: Date, hourly: boolean): Date {
  const result = new Date(date);
  if (hourly) result.setMinutes(0, 0, 0);
  else result.setHours(0, 0, 0, 0);
  return result;
}

function formatPlayBucket(date: Date, hourly: boolean): string {
  const datePart = [
    date.getFullYear().toString().padStart(4, "0"),
    (date.getMonth() + 1).toString().padStart(2, "0"),
    date.getDate().toString().padStart(2, "0"),
  ].join("-");
  if (!hourly) return datePart;
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
