import { describe, expect, it } from "vitest";
import {
  evenlySpacedIndices,
  fillPlaysOverTimeGaps,
  formatBucketAxisLabel,
  formatBucketLabel,
  getPlayBucket,
  getPlaysOverTimeGranularity,
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
  it("recognises each bucket format the server and the gap filler write", () => {
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

describe("fillPlaysOverTimeGaps", () => {
  it("returns nothing for an empty series", () => {
    expect(fillPlaysOverTimeGaps([], "week")).toEqual([]);
  });

  it("fills missing all-time monthly buckets for shorter histories", () => {
    const points = fillPlaysOverTimeGaps(
      [
        { timestamp: "2026-11", value: 1 },
        { timestamp: "2026-09", value: 3 },
      ],
      "all_time",
      new Date(2026, 10, 14, 12),
    );

    expect(points).toEqual([
      { timestamp: "2026-09", value: 3 },
      { timestamp: "2026-10", value: 0 },
      { timestamp: "2026-11", value: 1 },
    ]);
  });

  it("sums longer all-time histories into yearly buckets", () => {
    const points = fillPlaysOverTimeGaps(
      [
        { timestamp: "2020-11", value: 3 },
        { timestamp: "2020-12", value: 2 },
        { timestamp: "2021-01", value: 4 },
      ],
      "all_time",
      new Date(2026, 9, 14),
    );

    expect(points).toEqual([
      { timestamp: "2020", value: 5 },
      { timestamp: "2021", value: 4 },
      { timestamp: "2022", value: 0 },
      { timestamp: "2023", value: 0 },
      { timestamp: "2024", value: 0 },
      { timestamp: "2025", value: 0 },
      { timestamp: "2026", value: 0 },
    ]);
  });

  it("fills today from midnight through the current hour", () => {
    const points = fillPlaysOverTimeGaps(
      [
        { timestamp: "2026-10-14 08:00:00", value: 2 },
        { timestamp: "2026-10-14 10:00:00", value: 1 },
      ],
      "today",
      new Date(2026, 9, 14, 10, 35),
    );

    expect(points).toHaveLength(11);
    expect(points[0]).toEqual({ timestamp: "2026-10-14 00:00:00", value: 0 });
    expect(points[8]).toEqual({ timestamp: "2026-10-14 08:00:00", value: 2 });
    expect(points[9]).toEqual({ timestamp: "2026-10-14 09:00:00", value: 0 });
    expect(points[10]).toEqual({ timestamp: "2026-10-14 10:00:00", value: 1 });
  });

  it("covers every day of a rolling week, including today", () => {
    const points = fillPlaysOverTimeGaps(
      [{ timestamp: "2026-10-12", value: 4 }],
      "week",
      new Date(2026, 9, 14, 18),
    );

    expect(points.map((point) => point.timestamp)).toEqual([
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
    ]);
    expect(points[5].value).toBe(4);
  });

  it("covers a rolling 30 and 365 days", () => {
    const now = new Date(2026, 9, 14);
    const point = [{ timestamp: "2026-10-01", value: 1 }];

    expect(fillPlaysOverTimeGaps(point, "month", now)).toHaveLength(31);
    expect(fillPlaysOverTimeGaps(point, "year", now)).toHaveLength(366);
  });

  it("keeps a series it cannot parse as it is, sorted", () => {
    const points = [
      { timestamp: "b", value: 1 },
      { timestamp: "a", value: 2 },
    ];

    expect(fillPlaysOverTimeGaps(points, "week")).toEqual([
      { timestamp: "a", value: 2 },
      { timestamp: "b", value: 1 },
    ]);
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
