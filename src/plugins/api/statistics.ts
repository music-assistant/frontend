import type { CommandOptions } from "./commandOptions";
import type {
  StatisticsDistributionItem,
  StatisticsGranularity,
  StatisticsGroupBy,
  StatisticsHeatmapPoint,
  StatisticsListeningTimeItem,
  StatisticsPeriod,
  StatisticsTimeSeriesPoint,
  StatisticsTopItemResult,
  MediaType,
} from "./interfaces";

type SendCommand = <Result>(
  command: string,
  args?: Record<string, unknown>,
  options?: CommandOptions,
) => Promise<Result>;

// user_ids combines the plays of these users; undefined is the current user
export class StatisticsApi {
  constructor(private readonly sendCommand: SendCommand) {}

  public async getTopItems(
    media_type: MediaType,
    period: StatisticsPeriod = "week",
    limit = 50,
    user_ids?: string[],
  ): Promise<StatisticsTopItemResult[]> {
    return this.sendStatisticsCommand("statistics/top_items", {
      media_type,
      period,
      limit,
      user_ids,
    });
  }

  public async getPlaysOverTime(
    period: StatisticsPeriod = "week",
    granularity: StatisticsGranularity = "day",
    user_ids?: string[],
  ): Promise<StatisticsTimeSeriesPoint[]> {
    return this.sendStatisticsCommand("statistics/plays_over_time", {
      period,
      granularity,
      user_ids,
    });
  }

  public async getListeningActivity(
    period: StatisticsPeriod = "week",
    user_ids?: string[],
  ): Promise<StatisticsHeatmapPoint[]> {
    return this.sendStatisticsCommand("statistics/listening_activity", {
      period,
      user_ids,
    });
  }

  public async getListeningTime(
    period: StatisticsPeriod = "week",
    group_by: StatisticsGroupBy = "artist",
    limit = 10,
    user_ids?: string[],
  ): Promise<StatisticsListeningTimeItem[]> {
    return this.sendStatisticsCommand("statistics/listening_time", {
      period,
      group_by,
      limit,
      user_ids,
    });
  }

  public async getGenreDistribution(
    period: StatisticsPeriod = "week",
    limit = 10,
    user_ids?: string[],
  ): Promise<StatisticsDistributionItem[]> {
    return this.sendStatisticsCommand("statistics/genre_distribution", {
      period,
      limit,
      user_ids,
    });
  }

  public async getDecadeDistribution(
    period: StatisticsPeriod = "all_time",
    limit = 10,
    user_ids?: string[],
  ): Promise<StatisticsDistributionItem[]> {
    return this.sendStatisticsCommand("statistics/decade_distribution", {
      period,
      limit,
      user_ids,
    });
  }

  private sendStatisticsCommand<T>(
    command: string,
    args: Record<string, unknown>,
  ): Promise<T> {
    // statistics bucket by calendar day and hour, so every command gets the
    // browser's IANA timezone; callers show their own inline error states
    return this.sendCommand<T>(
      command,
      { ...args, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      { suppressGlobalError: true },
    );
  }
}
