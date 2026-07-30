import { describe, it, expect } from "vitest";
import { mapWithConcurrency, type SettledResult } from "./concurrency";

/** Resolve after a short, deterministic delay. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("mapWithConcurrency", () => {
  it("returns results in input order", async () => {
    const results = await mapWithConcurrency(
      [1, 2, 3, 4],
      2,
      async (value) => value * 10,
    );
    expect(results).toEqual([
      { status: "fulfilled", value: 10 },
      { status: "fulfilled", value: 20 },
      { status: "fulfilled", value: 30 },
      { status: "fulfilled", value: 40 },
    ]);
  });

  it("never exceeds the concurrency limit", async () => {
    const items = Array.from({ length: 12 }, (_, index) => index);
    let activeCount = 0;
    let maxActiveCount = 0;

    await mapWithConcurrency(items, 4, async () => {
      activeCount += 1;
      maxActiveCount = Math.max(maxActiveCount, activeCount);
      await delay(5);
      activeCount -= 1;
    });

    expect(maxActiveCount).toBeLessThanOrEqual(4);
    // With 12 items and a limit of 4 we expect the limit to actually be reached.
    expect(maxActiveCount).toBe(4);
  });

  it("continues past individual failures and records them", async () => {
    const results = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
      if (value % 2 === 0) throw new Error(`fail-${value}`);
      return value;
    });

    const statuses = results.map((result) => result.status);
    expect(statuses).toEqual([
      "fulfilled",
      "rejected",
      "fulfilled",
      "rejected",
    ]);

    const failures = results.filter(
      (
        result,
      ): result is Extract<SettledResult<number>, { status: "rejected" }> =>
        result.status === "rejected",
    );
    expect(failures).toHaveLength(2);
    expect((failures[0].reason as Error).message).toBe("fail-2");
  });

  it("processes every item exactly once", async () => {
    const items = Array.from({ length: 20 }, (_, index) => index);
    const processed: number[] = [];
    await mapWithConcurrency(items, 3, async (value) => {
      await delay(1);
      processed.push(value);
      return value;
    });
    expect(processed.slice().sort((a, b) => a - b)).toEqual(items);
  });

  it("handles an empty input list", async () => {
    const results = await mapWithConcurrency([], 4, async (value) => value);
    expect(results).toEqual([]);
  });
});
