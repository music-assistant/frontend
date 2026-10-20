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
