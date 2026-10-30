import { describe, expect, it } from "vitest";
import {
  evenlySpacedIndices,
  formatBucketAxisLabel,
  formatBucketLabel,
  getPlayBucket,
  getPlaysOverTimeGranularity,
  groupLongHistoryByYear,
  parsePlayBucket,
  summarizePlays,
} from "./statistics_time_series";

describe("getPlaysOverTimeGranularity", () => {
  it("uses hours for today, months for all time and days otherwise", () => {
    expect(getPlaysOverTimeGranularity("today")).toBe("hour");
    expect(getPlaysOverTimeGranularity("week")).toBe("day");
    expect(getPlaysOverTimeGranularity("month")).toBe("day");
    expect(getPlaysOverTimeGranularity("year")).toBe("day");
    expect(getPlaysOverTimeGranularity("all_time")).toBe("month");
  });
});

describe("getPlayBucket and parsePlayBucket", () => {
  it("recognises each bucket format the server and the yearly grouping write", () => {
    expect(getPlayBucket("2026")).toBe("year");
    expect(getPlayBucket("2026-10")).toBe("month");
    expect(getPlayBucket("2026-10-14")).toBe("day");
    expect(getPlayBucket("2026-10-14 09:00:00")).toBe("hour");
    expect(getPlayBucket("14 October")).toBeUndefined();
  });

  it("parses buckets as local dates", () => {
    expect(parsePlayBucket("2026")).toEqual(new Date(2026, 0, 1));
    expect(parsePlayBucket("2026-10")).toEqual(new Date(2026, 9, 1));
    expect(parsePlayBucket("2026-10-14")).toEqual(new Date(2026, 9, 14));
    expect(parsePlayBucket("2026-10-14 09:00:00")).toEqual(
      new Date(2026, 9, 14, 9),
    );
    expect(parsePlayBucket("not a date")).toBeUndefined();
  });
});

describe("groupLongHistoryByYear", () => {
  const months = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      timestamp: `${2020 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`,
      value: 1,
    }));

  it("keeps five years of months as they are", () => {
    const points = months(60);

    expect(groupLongHistoryByYear(points, "all_time")).toBe(points);
  });

  it("sums a longer all-time history into years", () => {
    const points = months(62);

    expect(groupLongHistoryByYear(points, "all_time")).toEqual([
      { timestamp: "2020", value: 12 },
      { timestamp: "2021", value: 12 },
      { timestamp: "2022", value: 12 },
      { timestamp: "2023", value: 12 },
      { timestamp: "2024", value: 12 },
      { timestamp: "2025", value: 2 },
    ]);
  });

  it("leaves the other periods alone", () => {
    const days = Array.from({ length: 366 }, (_, index) => ({
      timestamp: `day ${index}`,
      value: 1,
    }));

    expect(groupLongHistoryByYear(days, "year")).toBe(days);
  });
});

describe("summarizePlays", () => {
  it("totals, averages over every bucket and finds the busiest one", () => {
    const summary = summarizePlays([
      { timestamp: "2026-10-12", value: 2 },
      { timestamp: "2026-10-13", value: 0 },
      { timestamp: "2026-10-14", value: 7 },
      { timestamp: "2026-10-15", value: 7 },
    ]);

    expect(summary.total).toBe(16);
    expect(summary.average).toBe(4);
    // the first of two equally busy buckets wins
    expect(summary.busiest).toEqual({ timestamp: "2026-10-14", value: 7 });
  });

  it("averages a rolling period per day of the period, not per bucket", () => {
    // a rolling week touches 8 calendar days
    const week = Array.from({ length: 8 }, (_, day) => ({
      timestamp: `2026-10-${String(10 + day).padStart(2, "0")}`,
      value: day === 0 ? 0 : 10,
    }));

    expect(summarizePlays(week, "week").average).toBe(10);
    expect(summarizePlays(week).average).toBe(8.75);
  });

  it("averages today and all time per bucket", () => {
    const hours = [
      { timestamp: "2026-10-14 08:00:00", value: 3 },
      { timestamp: "2026-10-14 09:00:00", value: 5 },
    ];

    expect(summarizePlays(hours, "today").average).toBe(4);
    expect(summarizePlays(hours, "all_time").average).toBe(4);
  });

  it("has no busiest bucket when nothing was played", () => {
    expect(summarizePlays([])).toEqual({ total: 0, average: 0 });
    expect(
      summarizePlays([{ timestamp: "2026-10-12", value: 0 }]).busiest,
    ).toBeUndefined();
  });
});

describe("bucket labels", () => {
  it("formats axis labels per bucket size", () => {
    expect(formatBucketAxisLabel("2026-10-14 09:00:00", "en-GB")).toBe("09:00");
    expect(formatBucketAxisLabel("2026-10-14", "en-GB")).toBe("14 Oct");
    expect(formatBucketAxisLabel("2026-10-14", "en-GB", true)).toBe("Wed");
    expect(formatBucketAxisLabel("2026-10", "en-GB")).toBe("Oct 26");
    expect(formatBucketAxisLabel("2026", "en-GB")).toBe("2026");
    expect(formatBucketAxisLabel("odd", "en-GB")).toBe("odd");
  });

  it("formats full labels per bucket size", () => {
    expect(formatBucketLabel("2026-10-14", "en-GB")).toBe(
      "Wednesday 14 October",
    );
    expect(formatBucketLabel("2026-10", "en-GB")).toBe("October 2026");
    expect(formatBucketLabel("2026", "en-GB")).toBe("2026");
    expect(formatBucketLabel("odd", "en-GB")).toBe("odd");
  });
});

describe("evenlySpacedIndices", () => {
  it("returns every index for a short series", () => {
    expect(evenlySpacedIndices(3, 6)).toEqual([0, 1, 2]);
  });

  it("spreads a long series and keeps both ends", () => {
    expect(evenlySpacedIndices(31, 4)).toEqual([0, 10, 20, 30]);
  });

  it("handles empty input and a single tick", () => {
    expect(evenlySpacedIndices(0, 4)).toEqual([]);
    expect(evenlySpacedIndices(10, 0)).toEqual([]);
    expect(evenlySpacedIndices(10, 1)).toEqual([0]);
  });
});
