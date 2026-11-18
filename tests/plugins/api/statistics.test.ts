import { describe, expect, it, vi } from "vitest";
import type { CommandOptions } from "@/plugins/api/commandOptions";
import { StatisticsApi } from "@/plugins/api/statistics";
import { MediaType } from "@/plugins/api/interfaces";

describe("statistics API", () => {
  it("uses the same item identity for history, trend and all-history count", async () => {
    const send = vi.fn().mockResolvedValue([]);
    const api = new StatisticsApi(send);
    const item = {
      item_id: "1",
      provider: "library",
      media_type: MediaType.ALBUM,
    } as const;
    await api.getPlayHistory(item, "month", 21, 20);
    await api.getPlaysOverTime("month", "day", {}, item);
    await api.getPlayCount(item);
    expect(send).toHaveBeenNthCalledWith(
      1,
      "statistics/play_history",
      {
        ...item,
        period: "month",
        limit: 21,
        offset: 20,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      { suppressGlobalError: true },
    );
    expect(send).toHaveBeenNthCalledWith(
      2,
      "statistics/plays_over_time",
      {
        ...item,
        period: "month",
        granularity: "day",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      { suppressGlobalError: true },
    );
    expect(send).toHaveBeenNthCalledWith(3, "statistics/play_count", item, {
      suppressGlobalError: true,
    });
  });
  it("sends the users and local timezone and suppresses the global error toast", async () => {
    const calls: Array<{
      command: string;
      args?: Record<string, unknown>;
      options?: CommandOptions;
    }> = [];
    const api = new StatisticsApi(
      async <Result>(
        command: string,
        args?: Record<string, unknown>,
        options?: CommandOptions,
      ): Promise<Result> => {
        calls.push({ command, args, options });
        return [] as Result;
      },
    );

    await api.getPlaysOverTime("month", "week", { users: ["alice", "bob"] });

    expect(calls).toEqual([
      {
        command: "statistics/plays_over_time",
        args: {
          period: "month",
          granularity: "week",
          users: ["alice", "bob"],
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        options: { suppressGlobalError: true },
      },
    ]);
  });
});
