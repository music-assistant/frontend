import { useRowRequests } from "@/composables/useRowRequests";
import {
  EventType,
  MediaType,
  type EventMessage,
} from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope, ref, type EffectScope } from "vue";

const { mockSubscribeMulti, mockUnsubscribe, mockOnLibrarySyncCompleted } =
  vi.hoisted(() => ({
    mockSubscribeMulti: vi.fn(),
    mockUnsubscribe: vi.fn(),
    mockOnLibrarySyncCompleted: vi.fn(),
  }));

vi.mock("@/composables/useLibrarySync", () => ({
  onLibrarySyncCompleted: mockOnLibrarySyncCompleted,
}));

vi.mock("@/plugins/api", () => ({
  api: { subscribe_multi: mockSubscribeMulti },
}));

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
  const { fetchOnce, refetchOnLibraryChange } = scope.run(() =>
    useRowRequests(item, (shown) => shown.id, onReset),
  )!;
  return { item, onReset, fetchOnce, refetchOnLibraryChange, scope };
}

/** Listens for library changes and returns a way to emit one. */
function watchLibrary(
  page: ReturnType<typeof setupRequests>,
  prefixesByType: Partial<Record<MediaType, string[]>>,
  reload: () => void,
) {
  mockSubscribeMulti.mockReturnValue(mockUnsubscribe);
  mockOnLibrarySyncCompleted.mockReturnValue(mockUnsubscribe);
  page.scope.run(() => page.refetchOnLibraryChange(prefixesByType, reload));
  const [events, listener] = mockSubscribeMulti.mock.lastCall!;
  expect(events).toEqual([
    EventType.MEDIA_ITEM_ADDED,
    EventType.MEDIA_ITEM_UPDATED,
    EventType.MEDIA_ITEM_DELETED,
  ]);
  return (mediaType: MediaType) =>
    (listener as (evt: EventMessage) => void)({
      event: EventType.MEDIA_ITEM_ADDED,
      data: { media_type: mediaType },
    });
}

/** Puts an item on screen, the way a page does once its details load. */
async function show(page: ReturnType<typeof setupRequests>, id: string) {
  page.item.value = { id };
  await flushPromises();
}

describe("useRowRequests", () => {
  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop());
    vi.useRealTimers();
    vi.clearAllMocks();
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

  it("refetches the affected keys once after a burst of library changes", async () => {
    vi.useFakeTimers();
    const page = setupRequests();
    await show(page, "a");
    const load = vi.fn().mockResolvedValue([]);
    const reload = vi.fn(async () => {
      await page.fetchOnce("releases:library", load, vi.fn());
      await page.fetchOnce("similar", load, vi.fn());
    });
    await reload();
    const emit = watchLibrary(
      page,
      { [MediaType.ALBUM]: ["releases"] },
      reload,
    );

    emit(MediaType.ALBUM);
    emit(MediaType.ALBUM);
    await vi.runAllTimersAsync();

    expect(reload).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("ignores changes to media types the rows do not hold", async () => {
    vi.useFakeTimers();
    const page = setupRequests();
    await show(page, "a");
    const reload = vi.fn();
    const emit = watchLibrary(
      page,
      { [MediaType.ALBUM]: ["releases"] },
      reload,
    );

    emit(MediaType.PLAYLIST);
    await vi.runAllTimersAsync();

    expect(reload).not.toHaveBeenCalled();
  });

  it("drops a response that arrives after its key was refetched", async () => {
    vi.useFakeTimers();
    const page = setupRequests();
    await show(page, "a");
    let resolveLoad: (items: string[]) => void = () => {};
    const store = vi.fn();
    const pending = page.fetchOnce(
      "releases",
      () =>
        new Promise<string[]>((resolve) => {
          resolveLoad = resolve;
        }),
      store,
    );
    const reload = () =>
      page.fetchOnce("releases", async () => ["fresh"], store);
    const emit = watchLibrary(
      page,
      { [MediaType.ALBUM]: ["releases"] },
      reload,
    );

    emit(MediaType.ALBUM);
    await vi.runAllTimersAsync();
    resolveLoad(["stale"]);
    await pending;

    expect(store).toHaveBeenCalledTimes(1);
    expect(store).toHaveBeenCalledWith(["fresh"]);
  });

  it("stops listening when the page goes away", async () => {
    const page = setupRequests();
    watchLibrary(page, { [MediaType.ALBUM]: ["releases"] }, vi.fn());

    page.scope.stop();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(2);
  });

  it("refetches the affected keys when a library sync finishes", async () => {
    vi.useFakeTimers();
    const page = setupRequests();
    await show(page, "a");
    const load = vi.fn().mockResolvedValue([]);
    const reload = () => page.fetchOnce("releases", load, vi.fn());
    await reload();
    watchLibrary(page, { [MediaType.ALBUM]: ["releases"] }, reload);
    const [mediaType, onSyncCompleted] =
      mockOnLibrarySyncCompleted.mock.lastCall!;

    (onSyncCompleted as () => void)();
    await vi.runAllTimersAsync();

    expect(mediaType).toBe(MediaType.ALBUM);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
