import { describe, expect, it } from "vitest";
import {
  createLatestRequestGate,
  loadStatisticsChartData,
} from "@/components/statistics/statisticsRequests";

describe("statistics requests", () => {
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
