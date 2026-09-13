import { useRowRequests } from "@/composables/useRowRequests";
import { flushPromises } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope, ref, type EffectScope } from "vue";

interface Item {
  id: string;
}

const scopes: EffectScope[] = [];

/** The composable with no item on screen yet. */
function setupRequests() {
  const item = ref<Item>();
  const onReset = vi.fn();
  const scope = effectScope();
  scopes.push(scope);
  const { fetchOnce } = scope.run(() =>
    useRowRequests(item, (shown) => shown.id, onReset),
  )!;
  return { item, onReset, fetchOnce };
}

/** Puts an item on screen, the way a page does once its details load. */
async function show(page: ReturnType<typeof setupRequests>, id: string) {
  page.item.value = { id };
  await flushPromises();
}

describe("useRowRequests", () => {
  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop());
    vi.restoreAllMocks();
  });

  it("requests a key once per item and stores the result", async () => {
    const page = setupRequests();
    await show(page, "a");
    const load = vi.fn().mockResolvedValue(["x"]);
    const store = vi.fn();

    await page.fetchOnce("rows", load, store);
    await page.fetchOnce("rows", load, store);

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith({ id: "a" });
    expect(store).toHaveBeenCalledTimes(1);
    expect(store).toHaveBeenCalledWith(["x"]);
  });

  it("requests nothing while no item is shown", async () => {
    const page = setupRequests();
    const load = vi.fn().mockResolvedValue([]);

    await page.fetchOnce("rows", load, vi.fn());

    expect(load).not.toHaveBeenCalled();
  });

  it("resets and requests again when the identity changes", async () => {
    const page = setupRequests();
    await show(page, "a");
    const load = vi.fn().mockResolvedValue([]);
    await page.fetchOnce("rows", load, vi.fn());
    expect(page.onReset).toHaveBeenCalledTimes(1);

    await show(page, "b");
    await page.fetchOnce("rows", load, vi.fn());

    expect(page.onReset).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith({ id: "b" });
  });

  it("drops a response that arrives after the identity changed", async () => {
    const page = setupRequests();
    await show(page, "a");
    let resolveLoad: (items: string[]) => void = () => {};
    const store = vi.fn();
    const pending = page.fetchOnce(
      "rows",
      () =>
        new Promise<string[]>((resolve) => {
          resolveLoad = resolve;
        }),
      store,
    );

    await show(page, "b");
    resolveLoad(["stale"]);
    await pending;

    expect(store).not.toHaveBeenCalled();
  });

  it("stores an empty list when the request fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const page = setupRequests();
    await show(page, "a");
    const store = vi.fn();

    await page.fetchOnce(
      "rows",
      () => Promise.reject(new Error("down")),
      store,
    );

    expect(store).toHaveBeenCalledWith([]);
  });
});
