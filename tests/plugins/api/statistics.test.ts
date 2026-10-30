import { describe, expect, it } from "vitest";
import type { CommandOptions } from "@/plugins/api/commandOptions";
import { StatisticsApi } from "@/plugins/api/statistics";

describe("statistics API", () => {
  it("includes the local timezone and suppresses the global error toast", async () => {
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

    await api.getPlaysOverTime("month", "week");

    expect(calls).toEqual([
      {
        command: "statistics/plays_over_time",
        args: {
          period: "month",
          granularity: "week",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        options: { suppressGlobalError: true },
      },
    ]);
  });
});
