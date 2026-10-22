import { describe, it, expect } from "vitest";
import { runWithConcurrency } from "./concurrency";

describe("runWithConcurrency", () => {
  it("processes every item and preserves input order", async () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const results = await runWithConcurrency(items, async (item) => item * 2);
    expect(results).toEqual(items.map((i) => i * 2));
  });

  it("never exceeds the concurrency limit", async () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    let inFlight = 0;
    let maxInFlight = 0;

    await runWithConcurrency(
      items,
      async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        inFlight--;
      },
      5,
    );

    expect(maxInFlight).toBeLessThanOrEqual(5);
  });

  it("keeps processing remaining items after a failure, then rethrows", async () => {
    const items = [1, 2, 3, 4, 5];
    const processed: number[] = [];

    await expect(
      runWithConcurrency(
        items,
        async (item) => {
          processed.push(item);
          if (item === 2) throw new Error("boom");
          return item;
        },
        1,
      ),
    ).rejects.toThrow("boom");

    expect(processed).toEqual(items);
  });

  it("handles an empty item list", async () => {
    await expect(runWithConcurrency([], async () => 1)).resolves.toEqual([]);
  });
});
