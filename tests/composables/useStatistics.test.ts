import { useStatistics } from "@/composables/useStatistics";
import {
  EventType,
  MediaType,
  type EventMessage,
  type StatisticsTopItemResult,
} from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, ref, type EffectScope } from "vue";

const { api, unsubscribe, toastError } = vi.hoisted(() => ({
  api: {
    getTopItems: vi.fn(),
    getPlaysOverTime: vi.fn(),
    getListeningActivity: vi.fn(),
    getListeningTime: vi.fn(),
    getDecadeDistribution: vi.fn(),
    subscribe: vi.fn(),
  },
  unsubscribe: vi.fn(),
  toastError: vi.fn(),
}));
const STATISTICS_LOAD_ERROR_TOAST_ID = "statistics-load-failed";

vi.mock("@/plugins/api", () => ({ default: api }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/plugins/store", () => ({
  store: { currentUser: { user_id: "self" } },
}));
vi.mock("vue-sonner", () => ({ toast: { error: toastError } }));

const scopes: EffectScope[] = [];

function setupStatistics(isVisible = true) {
  const visible = ref(isVisible);
  const scope = effectScope();
  scopes.push(scope);
  const statistics = scope.run(() => useStatistics(visible))!;
  return { visible, scope, ...statistics };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function topItem(itemId: string): StatisticsTopItemResult {
  return {
    item: {
      item_id: itemId,
      provider: "library",
      media_type: MediaType.TRACK,
      name: itemId,
      uri: `track://library/${itemId}`,
      available: true,
    },
    play_count: 1,
  } as StatisticsTopItemResult;
}

function emitPlaylog(userid: string | null, fullyPlayed: boolean): void {
  const listener = api.subscribe.mock.calls[0][1] as (
    event: EventMessage,
  ) => void;
  listener({
    event: EventType.PLAYLOG_UPDATED,
    data: { userid, fully_played: fullyPlayed },
  } as EventMessage);
}

describe("useStatistics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    for (const request of [
      api.getTopItems,
      api.getPlaysOverTime,
      api.getListeningActivity,
      api.getListeningTime,
      api.getDecadeDistribution,
    ]) {
      request.mockResolvedValue([]);
    }
    api.subscribe.mockReturnValue(unsubscribe);
  });

  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop());
    vi.restoreAllMocks();
  });

  it("loads visible statistics once with the existing defaults", async () => {
    const statistics = setupStatistics();
    await flushPromises();

    expect(api.getTopItems).toHaveBeenCalledWith(MediaType.TRACK, "week", 50);
    expect(api.getTopItems).toHaveBeenCalledWith(MediaType.ARTIST, "week", 10);
    expect(api.getPlaysOverTime).toHaveBeenCalledExactlyOnceWith("week", "day");
    expect(statistics.statisticsLoading.value).toBe(false);
    expect(statistics.chartsLoading.value).toBe(false);
  });

  it("requests nothing while hidden and loads when revealed", async () => {
    const statistics = setupStatistics(false);
    statistics.refresh();
    emitPlaylog("self", true);
    await flushPromises();
    expect(api.getTopItems).not.toHaveBeenCalled();

    statistics.visible.value = true;
    await flushPromises();
    expect(api.getTopItems).toHaveBeenCalledTimes(2);
  });

  it("changes tabs without refetching the period-wide charts", async () => {
    const statistics = setupStatistics();
    await flushPromises();
    statistics.activeStatTab.value = MediaType.ALBUM;
    await flushPromises();

    expect(api.getTopItems).toHaveBeenLastCalledWith(
      MediaType.ALBUM,
      "week",
      50,
    );
    expect(api.getTopItems).toHaveBeenCalledTimes(3);
  });

  it("refreshes both datasets and hourly buckets when the period changes", async () => {
    const statistics = setupStatistics();
    await flushPromises();
    statistics.activeStatPeriod.value = "today";
    await flushPromises();

    expect(api.getTopItems).toHaveBeenLastCalledWith(
      MediaType.ARTIST,
      "today",
      10,
    );
    expect(api.getPlaysOverTime).toHaveBeenLastCalledWith("today", "hour");
    expect(api.getTopItems).toHaveBeenCalledTimes(4);
  });

  it("drops stale top-item and chart responses after a period change", async () => {
    const oldItems = deferred<StatisticsTopItemResult[]>();
    const oldArtists = deferred<StatisticsTopItemResult[]>();
    api.getTopItems
      .mockReturnValueOnce(oldItems.promise)
      .mockReturnValueOnce(oldArtists.promise)
      .mockResolvedValueOnce([topItem("new")])
      .mockResolvedValueOnce([topItem("new")]);
    const statistics = setupStatistics();
    statistics.activeStatPeriod.value = "month";
    await flushPromises();
    oldItems.resolve([topItem("old")]);
    oldArtists.resolve([topItem("old")]);
    await flushPromises();

    expect(statistics.statisticsItems.value).toEqual([topItem("new")]);
    expect(statistics.artistDistribution.value).toEqual([topItem("new")]);
  });

  it("invalidates pending results when the row is hidden", async () => {
    const pending = deferred<StatisticsTopItemResult[]>();
    api.getTopItems.mockReturnValueOnce(pending.promise);
    const statistics = setupStatistics();
    statistics.visible.value = false;
    await flushPromises();
    pending.resolve([topItem("hidden")]);
    await flushPromises();

    expect(statistics.statisticsItems.value).toEqual([]);
    expect(statistics.statisticsLoading.value).toBe(false);
    expect(statistics.chartsLoading.value).toBe(false);
  });

  it("shows top-item failures in the row without a duplicate toast", async () => {
    api.getTopItems.mockRejectedValueOnce(new Error("failed"));
    const statistics = setupStatistics();
    await flushPromises();

    expect(statistics.statisticsError.value).toBe(true);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("deduplicates notifications when ranking and chart requests both fail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    api.getTopItems
      .mockRejectedValueOnce(new Error("ranking failed"))
      .mockRejectedValueOnce(new Error("artist chart failed"));
    const statistics = setupStatistics();
    await flushPromises();

    expect(statistics.statisticsError.value).toBe(true);
    expect(toastError).toHaveBeenCalledExactlyOnceWith(
      "statistics_load_failed",
      { id: STATISTICS_LOAD_ERROR_TOAST_ID },
    );
  });

  it("keeps successful chart data when another chart fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    api.getListeningActivity.mockRejectedValueOnce(new Error("failed"));
    api.getPlaysOverTime.mockResolvedValueOnce([
      { timestamp: "2026-10-20", value: 3 },
    ]);
    const statistics = setupStatistics();
    await flushPromises();

    expect(statistics.playsOverTime.value).toEqual([
      { timestamp: "2026-10-20", value: 3 },
    ]);
    expect(statistics.listeningActivity.value).toEqual([]);
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("refreshes only completed plays belonging to the current user", async () => {
    setupStatistics();
    await flushPromises();
    emitPlaylog("other", true);
    emitPlaylog("self", false);
    await flushPromises();
    expect(api.getTopItems).toHaveBeenCalledTimes(2);

    emitPlaylog("self", true);
    await flushPromises();
    expect(api.getTopItems).toHaveBeenCalledTimes(4);
  });

  it("disposes subscriptions and ignores late failures when the scope stops", async () => {
    const pending = deferred<StatisticsTopItemResult[]>();
    api.getTopItems.mockReturnValueOnce(pending.promise);
    const statistics = setupStatistics();
    statistics.scope.stop();
    statistics.activeStatTab.value = MediaType.ALBUM;
    statistics.refresh();
    pending.reject(new Error("late failure"));
    await flushPromises();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(api.getTopItems).toHaveBeenCalledTimes(2);
    expect(statistics.statisticsError.value).toBe(false);
    expect(statistics.statisticsLoading.value).toBe(false);
    expect(toastError).not.toHaveBeenCalled();
  });
});
