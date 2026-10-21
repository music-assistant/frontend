import { describe, expect, it } from "vitest";
import {
  createLatestRequestGate,
  fillPlaysOverTimeGaps,
  formatPlaysOverTimeLabel,
  getPlaysOverTimeGranularity,
  loadStatisticsChartData,
} from "@/components/statistics/statisticsRequests";

describe("statistics requests", () => {
  it("uses hourly buckets for today and daily buckets for longer periods", () => {
    expect(getPlaysOverTimeGranularity("today")).toBe("hour");
    expect(getPlaysOverTimeGranularity("week")).toBe("day");
    expect(getPlaysOverTimeGranularity("all_time")).toBe("day");
  });

  it("shows only the hour for today and keeps dates for longer periods", () => {
    const timestamp = "2026-10-14 09:00:00";

    expect(formatPlaysOverTimeLabel(timestamp, "today")).toBe("09:00");
    expect(formatPlaysOverTimeLabel(timestamp, "week")).toBe(timestamp);
  });

  it("fills missing daily trend buckets with zero plays", () => {
    const points = fillPlaysOverTimeGaps(
      [
        { timestamp: "2026-10-12", value: 3 },
        { timestamp: "2026-10-14", value: 1 },
      ],
      "all_time",
      new Date(2026, 9, 14, 12),
    );

    expect(points).toEqual([
      { timestamp: "2026-10-12", value: 3 },
      { timestamp: "2026-10-13", value: 0 },
      { timestamp: "2026-10-14", value: 1 },
    ]);
  });

  it("fills today's hourly trend from midnight through the current hour", () => {
    const points = fillPlaysOverTimeGaps(
      [
        { timestamp: "2026-10-14 08:00:00", value: 2 },
        { timestamp: "2026-10-14 10:00:00", value: 1 },
      ],
      "today",
      new Date(2026, 9, 14, 10, 35),
    );

    expect(points).toEqual([
      { timestamp: "2026-10-14 00:00:00", value: 0 },
      { timestamp: "2026-10-14 01:00:00", value: 0 },
      { timestamp: "2026-10-14 02:00:00", value: 0 },
      { timestamp: "2026-10-14 03:00:00", value: 0 },
      { timestamp: "2026-10-14 04:00:00", value: 0 },
      { timestamp: "2026-10-14 05:00:00", value: 0 },
      { timestamp: "2026-10-14 06:00:00", value: 0 },
      { timestamp: "2026-10-14 07:00:00", value: 0 },
      { timestamp: "2026-10-14 08:00:00", value: 2 },
      { timestamp: "2026-10-14 09:00:00", value: 0 },
      { timestamp: "2026-10-14 10:00:00", value: 1 },
    ]);
  });

  it("marks earlier requests stale and invalidates requests when hidden", () => {
    const gate = createLatestRequestGate();
    const previous = gate.begin();
    const current = gate.begin();

    expect(gate.isCurrent(previous)).toBe(false);
    expect(gate.isCurrent(current)).toBe(true);

    gate.invalidate();
    expect(gate.isCurrent(current)).toBe(false);
  });

  it("keeps successful charts when one endpoint rejects", async () => {
    const result = await loadStatisticsChartData({
      artistDistribution: Promise.resolve([]),
      playsOverTime: Promise.resolve([{ timestamp: "2026-10-12", value: 3 }]),
      listeningActivity: Promise.reject(new Error("not available")),
      listeningTime: Promise.resolve([{ name: "Artist", minutes: 12 }]),
      decadeDistribution: Promise.resolve([{ name: "1980s", value: 2 }]),
    });

    expect(result.hasFailures).toBe(true);
    expect(result.data.playsOverTime).toEqual([
      { timestamp: "2026-10-12", value: 3 },
    ]);
    expect(result.data.listeningActivity).toEqual([]);
    expect(result.data.listeningTime).toEqual([
      { name: "Artist", minutes: 12 },
    ]);
  });
});
