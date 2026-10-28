import { useListingTotal } from "@/composables/useListingTotal";
import { describe, expect, it } from "vitest";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

describe("useListingTotal", () => {
  it("shows a count once it comes back", async () => {
    const { total, loadTotal } = useListingTotal(128);

    await loadTotal(Promise.resolve(12));

    expect(total.value).toBe(12);
  });

  it("shows no count while a new one is on its way", () => {
    const { total, loadTotal } = useListingTotal(128);

    void loadTotal(deferred<number>().promise);

    expect(total.value).toBeUndefined();
  });

  it("drops a count that comes back after the filters were cleared", async () => {
    const { total, setTotal, loadTotal } = useListingTotal(128);
    const favorites = deferred<number>();

    const pending = loadTotal(favorites.promise);
    setTotal(128);
    favorites.resolve(12);
    await pending;

    expect(total.value).toBe(128);
  });

  it("keeps the latest of two counts on their way", async () => {
    const { total, loadTotal } = useListingTotal();
    const first = deferred<number>();
    const second = deferred<number>();

    const firstDone = loadTotal(first.promise);
    const secondDone = loadTotal(second.promise);
    second.resolve(5);
    first.resolve(12);
    await Promise.all([firstDone, secondDone]);

    expect(total.value).toBe(5);
  });
});
