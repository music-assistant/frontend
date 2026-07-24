/**
 * Bounded-concurrency async mapping.
 *
 * Runs an async `worker` over `items` with at most `concurrency` operations in
 * flight at once. Unlike `Promise.all`, a rejected worker never aborts the
 * whole batch: every item produces a settled result so callers can continue
 * with the successful results and surface a partial-failure state.
 */

export type SettledResult<TValue> =
  | { status: "fulfilled"; value: TValue }
  | { status: "rejected"; reason: unknown };

/**
 * Map over `items` with a concurrency limit, collecting a settled result for
 * each item (in input order). The optional `onSettled` callback fires as each
 * item completes and is useful for reporting incremental loading progress.
 */
export async function mapWithConcurrency<TInput, TOutput>(
  items: readonly TInput[],
  concurrency: number,
  worker: (item: TInput, index: number) => Promise<TOutput>,
  onSettled?: (result: SettledResult<TOutput>, index: number) => void,
): Promise<SettledResult<TOutput>[]> {
  const results: SettledResult<TOutput>[] = Array.from({
    length: items.length,
  });
  const concurrencyLimit = Math.max(1, Math.floor(concurrency));
  let nextIndex = 0;

  const runWorkerLoop = async (): Promise<void> => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) return;

      let settled: SettledResult<TOutput>;
      try {
        settled = {
          status: "fulfilled",
          value: await worker(items[currentIndex], currentIndex),
        };
      } catch (error) {
        settled = { status: "rejected", reason: error };
      }
      results[currentIndex] = settled;
      onSettled?.(settled, currentIndex);
    }
  };

  const activeWorkerCount = Math.min(concurrencyLimit, items.length);
  await Promise.all(
    Array.from({ length: activeWorkerCount }, () => runWorkerLoop()),
  );
  return results;
}
