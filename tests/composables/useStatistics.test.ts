import {
  PLAYLOG_REFRESH_DEBOUNCE_MS,
  TOP_ITEMS_LIMIT,
  useStatistics,
  useStatisticsTopItems,
  type StatisticsSection,
  type TopItemsMediaType,
} from "@/composables/useStatistics";
import { ConnectionState } from "@/plugins/api";
import {
  EventType,
  MediaType,
  type EventMessage,
  type StatisticsPeriod,
  type StatisticsTopItemResult,
} from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, ref, type EffectScope } from "vue";

const { api, unsubscribe, toastError } = vi.hoisted(() => ({
  api: {
    state: { value: "initialized" },
    getTopItems: vi.fn(),
    getPlaysOverTime: vi.fn(),
    getListeningActivity: vi.fn(),
    getListeningTime: vi.fn(),
    getGenreDistribution: vi.fn(),
    getDecadeDistribution: vi.fn(),
    subscribe: vi.fn(),
  },
  unsubscribe: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  default: api,
  ConnectionState: {
    INITIALIZED: "initialized",
    RECONNECTING: "reconnecting",
  },
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/plugins/store", () => ({
  store: { currentUser: { user_id: "self" } },
}));
vi.mock("vue-sonner", () => ({ toast: { error: toastError } }));

const ALL_SECTIONS: StatisticsSection[] = [
  "playsOverTime",
  "topTracks",
  "topArtists",
  "listeningActivity",
  "listeningTime",
  "genreDistribution",
  "decadeDistribution",
];

const scopes: EffectScope[] = [];

function setupStatistics(
  sections: StatisticsSection[] = ALL_SECTIONS,
  isActive = true,
) {
  const active = ref(isActive);
  const period = ref<StatisticsPeriod>("week");
  const scope = effectScope();
  scopes.push(scope);
  const statistics = scope.run(() =>
    useStatistics({ active, period, sections }),
  )!;
  return { active, period, scope, ...statistics };
}

function setupTopItems() {
  const active = ref(true);
  const period = ref<StatisticsPeriod>("week");
  const mediaType = ref<TopItemsMediaType>(MediaType.ALBUM);
  const scope = effectScope();
  scopes.push(scope);
  const topItems = scope.run(() =>
    useStatisticsTopItems({ active, period, mediaType }),
  )!;
  return { active, period, mediaType, ...topItems };
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

function topItem(
  itemId: string,
  mediaType: MediaType = MediaType.TRACK,
): StatisticsTopItemResult {
  return {
    item: {
      item_id: itemId,
      provider: "library",
      media_type: mediaType,
      name: itemId,
      uri: `${mediaType}://library/${itemId}`,
      available: true,
    },
    play_count: 1,
  } as StatisticsTopItemResult;
}

function emitPlaylog(userid: string | null, fullyPlayed: boolean): void {
  for (const [, listener] of api.subscribe.mock.calls) {
    (listener as (event: EventMessage) => void)({
      event: EventType.PLAYLOG_UPDATED,
      data: { userid, fully_played: fullyPlayed },
    } as EventMessage);
  }
}

describe("useStatistics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.state = ref(ConnectionState.INITIALIZED);
    for (const request of [
      api.getTopItems,
      api.getPlaysOverTime,
      api.getListeningActivity,
      api.getListeningTime,
      api.getGenreDistribution,
      api.getDecadeDistribution,
    ]) {
      request.mockResolvedValue([]);
    }
    api.subscribe.mockReturnValue(unsubscribe);
  });

  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop());
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("loads every requested section of the period in parallel", async () => {
    const statistics = setupStatistics();
    expect(statistics.loading.value).toBe(true);
    await flushPromises();

    expect(api.getPlaysOverTime).toHaveBeenCalledExactlyOnceWith("week", "day");
    expect(api.getTopItems).toHaveBeenCalledWith(
      MediaType.TRACK,
      "week",
      TOP_ITEMS_LIMIT,
    );
    expect(api.getTopItems).toHaveBeenCalledWith(MediaType.ARTIST, "week", 10);
    expect(api.getListeningActivity).toHaveBeenCalledWith("week");
    expect(api.getListeningTime).toHaveBeenCalledWith("week", "artist", 10);
    expect(api.getGenreDistribution).toHaveBeenCalledWith("week", 10);
    expect(api.getDecadeDistribution).toHaveBeenCalledWith("week", 10);
    expect(statistics.loading.value).toBe(false);
    expect(statistics.failed.value.size).toBe(0);
  });

  it("requests only the sections asked for", async () => {
    setupStatistics(["playsOverTime"]);
    await flushPromises();

    expect(api.getPlaysOverTime).toHaveBeenCalledTimes(1);
    expect(api.getTopItems).not.toHaveBeenCalled();
    expect(api.getListeningActivity).not.toHaveBeenCalled();
  });

  it("gap-fills plays over time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 14, 12));
    api.getPlaysOverTime.mockResolvedValue([
      { timestamp: "2026-10-12", value: 3 },
    ]);
    const statistics = setupStatistics(["playsOverTime"]);
    await flushPromises();

    expect(statistics.data.value.playsOverTime).toHaveLength(8);
    expect(statistics.data.value.playsOverTime[5]).toEqual({
      timestamp: "2026-10-12",
      value: 3,
    });
  });

  it("requests nothing while inactive and loads once active", async () => {
    const statistics = setupStatistics(["playsOverTime"], false);
    await flushPromises();
    expect(api.getPlaysOverTime).not.toHaveBeenCalled();
    expect(statistics.loading.value).toBe(false);

    statistics.active.value = true;
    await flushPromises();
    expect(api.getPlaysOverTime).toHaveBeenCalledTimes(1);
  });

  it("requests nothing until the connection is ready", async () => {
    api.state.value = ConnectionState.RECONNECTING;
    setupStatistics(["playsOverTime"]);
    await flushPromises();
    expect(api.getPlaysOverTime).not.toHaveBeenCalled();

    api.state.value = ConnectionState.INITIALIZED;
    await flushPromises();
    expect(api.getPlaysOverTime).toHaveBeenCalledTimes(1);
  });

  it("keeps the sections that loaded and marks the failed ones", async () => {
    api.getListeningActivity.mockRejectedValue(new Error("offline"));
    api.getTopItems.mockResolvedValue([topItem("track")]);
    const statistics = setupStatistics();
    await flushPromises();

    expect([...statistics.failed.value]).toEqual(["listeningActivity"]);
    expect(statistics.data.value.topTracks).toEqual([topItem("track")]);
    expect(statistics.data.value.listeningActivity).toEqual([]);
  });

  it("shows no toast when an automatic load fails", async () => {
    api.getPlaysOverTime.mockRejectedValue(new Error("offline"));
    setupStatistics(["playsOverTime"]);
    await flushPromises();

    expect(toastError).not.toHaveBeenCalled();
  });

  it("toasts when a load the user asked for by changing the period fails", async () => {
    const statistics = setupStatistics(["playsOverTime"]);
    await flushPromises();
    api.getPlaysOverTime.mockRejectedValue(new Error("offline"));

    statistics.period.value = "month";
    await flushPromises();

    expect(api.getPlaysOverTime).toHaveBeenLastCalledWith("month", "day");
    expect(toastError).toHaveBeenCalledExactlyOnceWith(
      "statistics_load_failed",
      { id: "statistics-load-failed" },
    );
    expect(statistics.failed.value.has("playsOverTime")).toBe(true);
  });

  it("ignores a slower response for an earlier period", async () => {
    const earlier = deferred<StatisticsTopItemResult[]>();
    api.getTopItems
      .mockReturnValueOnce(earlier.promise)
      .mockResolvedValueOnce([topItem("current")]);
    const statistics = setupStatistics(["topTracks"]);

    statistics.period.value = "year";
    await flushPromises();
    earlier.resolve([topItem("stale")]);
    await flushPromises();

    expect(statistics.data.value.topTracks).toEqual([topItem("current")]);
    expect(statistics.loading.value).toBe(false);
  });

  it("drops a response that arrives after becoming inactive", async () => {
    const pending = deferred<StatisticsTopItemResult[]>();
    api.getTopItems.mockReturnValueOnce(pending.promise);
    const statistics = setupStatistics(["topTracks"]);

    statistics.active.value = false;
    await flushPromises();
    pending.resolve([topItem("late")]);
    await flushPromises();

    expect(statistics.data.value.topTracks).toEqual([]);
    expect(statistics.loading.value).toBe(false);
  });

  it("refreshes once, debounced, when the current user finishes tracks", async () => {
    vi.useFakeTimers();
    setupStatistics(["playsOverTime"]);
    await flushPromises();
    expect(api.getPlaysOverTime).toHaveBeenCalledTimes(1);

    emitPlaylog("self", true);
    emitPlaylog(null, true);
    emitPlaylog("self", false);
    emitPlaylog("someone-else", true);
    vi.advanceTimersByTime(PLAYLOG_REFRESH_DEBOUNCE_MS - 1);
    expect(api.getPlaysOverTime).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    await flushPromises();
    expect(api.getPlaysOverTime).toHaveBeenCalledTimes(2);
  });

  it("stops listening and cancels a pending refresh when disposed", async () => {
    vi.useFakeTimers();
    const statistics = setupStatistics(["playsOverTime"]);
    await flushPromises();
    emitPlaylog("self", true);

    statistics.scope.stop();
    vi.advanceTimersByTime(PLAYLOG_REFRESH_DEBOUNCE_MS);
    await flushPromises();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(api.getPlaysOverTime).toHaveBeenCalledTimes(1);
  });
});

describe("useStatisticsTopItems", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.state = ref(ConnectionState.INITIALIZED);
    api.getTopItems.mockResolvedValue([]);
    api.subscribe.mockReturnValue(unsubscribe);
  });

  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop());
  });

  it("loads the chosen media type and reloads when it changes", async () => {
    api.getTopItems.mockResolvedValueOnce([topItem("album", MediaType.ALBUM)]);
    const topItems = setupTopItems();
    await flushPromises();

    expect(api.getTopItems).toHaveBeenCalledWith(
      MediaType.ALBUM,
      "week",
      TOP_ITEMS_LIMIT,
    );
    expect(topItems.items.value).toEqual([topItem("album", MediaType.ALBUM)]);

    topItems.mediaType.value = MediaType.PLAYLIST;
    await flushPromises();
    expect(api.getTopItems).toHaveBeenLastCalledWith(
      MediaType.PLAYLIST,
      "week",
      TOP_ITEMS_LIMIT,
    );
    expect(api.getTopItems).toHaveBeenCalledTimes(2);
  });

  it("shows an error and toasts when a tab the user picked fails", async () => {
    const topItems = setupTopItems();
    await flushPromises();
    api.getTopItems.mockRejectedValueOnce(new Error("offline"));

    topItems.mediaType.value = MediaType.ARTIST;
    await flushPromises();

    expect(topItems.error.value).toBe(true);
    expect(topItems.items.value).toEqual([]);
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("does not count becoming active as the user's choice", async () => {
    const topItems = setupTopItems();
    topItems.active.value = false;
    await flushPromises();
    api.getTopItems.mockRejectedValueOnce(new Error("offline"));

    topItems.active.value = true;
    await flushPromises();

    expect(topItems.error.value).toBe(true);
    expect(toastError).not.toHaveBeenCalled();
  });
});
