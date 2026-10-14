import type { TopItemResult } from "@/plugins/api/interfaces";

export interface StatisticsChartData {
  artistDistribution: TopItemResult[];
  playsOverTime: Array<{ timestamp: string; value: number }>;
  listeningActivity: Array<{ hour: number; weekday: number; value: number }>;
  listeningTime: Array<{ name: string; minutes: number }>;
  decadeDistribution: Array<{ name: string; value: number }>;
}

export interface StatisticsChartRequests {
  artistDistribution: Promise<TopItemResult[]>;
  playsOverTime: Promise<Array<{ timestamp: string; value: number }>>;
  listeningActivity: Promise<
    Array<{ hour: number; weekday: number; value: number }>
  >;
  listeningTime: Promise<Array<{ name: string; minutes: number }>>;
  decadeDistribution: Promise<Array<{ name: string; value: number }>>;
}

export function getPlaysOverTimeGranularity(period: string): "hour" | "day" {
  return period === "today" ? "hour" : "day";
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
