import type { StatisticsPeriod } from "@/plugins/api/interfaces";

/** Every period the statistics commands accept, shortest first. */
export const STATISTICS_PERIODS: readonly StatisticsPeriod[] = [
  "today",
  "week",
  "month",
  "year",
  "all_time",
];

/** The period statistics open with. */
export const DEFAULT_STATISTICS_PERIOD: StatisticsPeriod = "week";

/** Whether a value, such as a route query, is a statistics period. */
export function isStatisticsPeriod(value: unknown): value is StatisticsPeriod {
  return (
    typeof value === "string" &&
    (STATISTICS_PERIODS as readonly string[]).includes(value)
  );
}

/** The period in a route query value, or the default one. */
export function parseStatisticsPeriod(value: unknown): StatisticsPeriod {
  const first = Array.isArray(value) ? value[0] : value;
  return isStatisticsPeriod(first) ? first : DEFAULT_STATISTICS_PERIOD;
}
