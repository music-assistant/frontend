import { describe, expect, it } from "vitest";
import {
  DEFAULT_STATISTICS_PERIOD,
  isStatisticsPeriod,
  parseStatisticsPeriod,
  STATISTICS_PERIODS,
} from "./statistics_period";

describe("isStatisticsPeriod", () => {
  it("accepts every period the server knows", () => {
    expect(STATISTICS_PERIODS.every(isStatisticsPeriod)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isStatisticsPeriod("decade")).toBe(false);
    expect(isStatisticsPeriod("")).toBe(false);
    expect(isStatisticsPeriod(undefined)).toBe(false);
    expect(isStatisticsPeriod(7)).toBe(false);
  });
});

describe("parseStatisticsPeriod", () => {
  it("reads a period from a route query value", () => {
    expect(parseStatisticsPeriod("month")).toBe("month");
    expect(parseStatisticsPeriod(["year", "today"])).toBe("year");
  });

  it("falls back to the default period", () => {
    expect(parseStatisticsPeriod(undefined)).toBe(DEFAULT_STATISTICS_PERIOD);
    expect(parseStatisticsPeriod("forever")).toBe(DEFAULT_STATISTICS_PERIOD);
    expect(parseStatisticsPeriod([])).toBe(DEFAULT_STATISTICS_PERIOD);
  });
});
