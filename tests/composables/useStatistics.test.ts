import {
  GENRE_DISTRIBUTION_LIMIT,
  PLAYLOG_REFRESH_DEBOUNCE_MS,
  TOP_ITEMS_LIMIT,
  useStatistics,
  useStatisticsTopItems,
  useStatisticsUsers,
  type StatisticsSection,
  type TopItemsMediaType,
} from "@/composables/useStatistics";
import { ConnectionState } from "@/plugins/api";
import {
  EventType,
  MediaType,
  type EventMessage,
  type StatisticsPeriod,
  type StatisticsTimeSeriesPoint,
  type StatisticsTopItemResult,
  type StatisticsUsers,
  type User,
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
    getAllUsers: vi.fn(),
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
  topItemsLimit?: number,
  selectedUsers: StatisticsUsers = {},
) {
  const active = ref(isActive);
  const period = ref<StatisticsPeriod>("week");
  const users = ref(selectedUsers);
  const scope = effectScope();
  scopes.push(scope);
  const statistics = scope.run(() =>
    useStatistics({ active, period, sections, topItemsLimit, users }),
  )!;
  return { active, period, users, scope, ...statistics };
}

function setupTopItems() {
  const active = ref(true);
  const period = ref<StatisticsPeriod>("week");
  const mediaType = ref<TopItemsMediaType>(MediaType.ALBUM);
  const users = ref<StatisticsUsers>({});
  const scope = effectScope();
  scopes.push(scope);
  const topItems = scope.run(() =>
    useStatisticsTopItems({ active, period, mediaType, users }),
  )!;
  return { active, period, mediaType, users, ...topItems };
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

  it.each([
    { sent: {} },
    { sent: { users: ["alice", "bob"] } },
    { sent: { all_users: true } },
  ])(
    "loads every requested section of the period in parallel for users $sent",
    async ({ sent }) => {
      const statistics = setupStatistics(ALL_SECTIONS, true, undefined, sent);
      expect(statistics.loading.value).toBe(true);
      await flushPromises();

      expect(api.getPlaysOverTime).toHaveBeenCalledExactlyOnceWith(
        "week",
        "day",
        sent,
      );
      expect(api.getTopItems).toHaveBeenCalledWith(
        MediaType.TRACK,
        "week",
        TOP_ITEMS_LIMIT,
        sent,
      );
      expect(api.getTopItems).toHaveBeenCalledWith(
        MediaType.ARTIST,
        "week",
        1,
        sent,
      );
      expect(api.getListeningActivity).toHaveBeenCalledWith("week", sent);
      expect(api.getListeningTime).toHaveBeenCalledWith(
        "week",
        "artist",
        10,
        sent,
      );
      expect(api.getGenreDistribution).toHaveBeenCalledWith(
        "week",
        GENRE_DISTRIBUTION_LIMIT,
        sent,
      );
      expect(api.getDecadeDistribution).toHaveBeenCalledWith("week", 10, sent);
      expect(statistics.loading.value).toBe(false);
      expect(statistics.failed.value.size).toBe(0);
    },
  );

  it("requests only the sections asked for", async () => {
    setupStatistics(["playsOverTime"]);
    await flushPromises();

    expect(api.getPlaysOverTime).toHaveBeenCalledTimes(1);
    expect(api.getTopItems).not.toHaveBeenCalled();
    expect(api.getListeningActivity).not.toHaveBeenCalled();
  });

  it("loads one artist, album and track for the teaser and follows its period", async () => {
    const statistics = setupStatistics(
      ["playsOverTime", "topArtists", "topAlbums", "topTracks"],
      false,
      1,
    );
    await flushPromises();
    expect(api.getTopItems).not.toHaveBeenCalled();
    statistics.active.value = true;
    await flushPromises();
    expect(api.getTopItems).toHaveBeenCalledWith(
      MediaType.ALBUM,
      "week",
      1,
      {},
    );
    expect(api.getTopItems).toHaveBeenCalledWith(
      MediaType.TRACK,
      "week",
      1,
      {},
    );
    expect(api.getTopItems).toHaveBeenCalledWith(
      MediaType.ARTIST,
      "week",
      1,
      {},
    );
    expect(api.getTopItems).toHaveBeenCalledTimes(3);
    statistics.period.value = "month";
    await flushPromises();
    expect(api.getTopItems).toHaveBeenCalledWith(
      MediaType.ALBUM,
      "month",
      1,
      {},
    );
    expect(api.getTopItems).toHaveBeenCalledWith(
      MediaType.TRACK,
      "month",
      1,
      {},
    );
    expect(api.getTopItems).toHaveBeenCalledWith(
      MediaType.ARTIST,
      "month",
      1,
      {},
    );
  });

  it("keeps the number-one artist limit when a larger track/album limit is requested", async () => {
    setupStatistics(["topArtists", "topAlbums", "topTracks"], true, 5);
    await flushPromises();
    expect(api.getTopItems).toHaveBeenCalledWith(
      MediaType.ARTIST,
      "week",
      1,
      {},
    );
    expect(api.getTopItems).toHaveBeenCalledWith(
      MediaType.ALBUM,
      "week",
      5,
      {},
    );
    expect(api.getTopItems).toHaveBeenCalledWith(
      MediaType.TRACK,
      "week",
      5,
      {},
    );
  });

  it("sums a long all-time history of plays into years", async () => {
    api.getPlaysOverTime.mockResolvedValue(
      Array.from({ length: 72 }, (_, index) => ({
        timestamp: `${2020 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`,
        value: 1,
      })),
    );
    const statistics = setupStatistics(["playsOverTime"]);
    statistics.period.value = "all_time";
    await flushPromises();

    expect(api.getPlaysOverTime).toHaveBeenLastCalledWith(
      "all_time",
      "month",
      {},
    );
    expect(statistics.data.value.playsOverTime).toHaveLength(6);
    expect(statistics.data.value.playsOverTime[0]).toEqual({
      timestamp: "2020",
      value: 12,
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

    expect(api.getPlaysOverTime).toHaveBeenLastCalledWith("month", "day", {});
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

  it.each([
    { users: {}, shown: "self", other: "someone-else" },
    { users: { users: ["alice", "bob"] }, shown: "bob", other: "self" },
    { users: { all_users: true }, shown: "someone-else", other: undefined },
  ])(
    "refreshes once, debounced, when a shown user finishes tracks ($users)",
    async ({ users, shown, other }) => {
      vi.useFakeTimers();
      setupStatistics(["playsOverTime"], true, undefined, users);
      await flushPromises();
      expect(api.getPlaysOverTime).toHaveBeenCalledTimes(1);

      emitPlaylog(shown, true);
      emitPlaylog(null, true);
      emitPlaylog(shown, false);
      if (other) emitPlaylog(other, true);
      vi.advanceTimersByTime(PLAYLOG_REFRESH_DEBOUNCE_MS - 1);
      expect(api.getPlaysOverTime).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      await flushPromises();
      expect(api.getPlaysOverTime).toHaveBeenCalledTimes(2);
    },
  );

  it("keeps the current data on screen during a background refresh", async () => {
    vi.useFakeTimers();
    api.getTopItems.mockResolvedValueOnce([topItem("first")]);
    const statistics = setupStatistics(["topTracks"]);
    await flushPromises();
    expect(statistics.data.value.topTracks).toEqual([topItem("first")]);
    const refreshed = deferred<StatisticsTopItemResult[]>();
    api.getTopItems.mockReturnValueOnce(refreshed.promise);

    emitPlaylog("self", true);
    vi.advanceTimersByTime(PLAYLOG_REFRESH_DEBOUNCE_MS);
    await flushPromises();
    expect(statistics.loading.value).toBe(false);

    refreshed.resolve([topItem("second")]);
    await flushPromises();
    expect(statistics.data.value.topTracks).toEqual([topItem("second")]);
  });

  it("shows loading again when the user picks another period", async () => {
    const statistics = setupStatistics(["playsOverTime"]);
    await flushPromises();
    api.getPlaysOverTime.mockReturnValueOnce(
      deferred<StatisticsTimeSeriesPoint[]>().promise,
    );

    statistics.period.value = "month";
    await flushPromises();

    expect(statistics.loading.value).toBe(true);
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

  it("loads the chosen media type and users and reloads when they change", async () => {
    api.getTopItems.mockResolvedValueOnce([topItem("album", MediaType.ALBUM)]);
    const topItems = setupTopItems();
    await flushPromises();

    expect(api.getTopItems).toHaveBeenCalledWith(
      MediaType.ALBUM,
      "week",
      TOP_ITEMS_LIMIT,
      {},
    );
    expect(topItems.items.value).toEqual([topItem("album", MediaType.ALBUM)]);

    topItems.mediaType.value = MediaType.PLAYLIST;
    await flushPromises();
    expect(api.getTopItems).toHaveBeenLastCalledWith(
      MediaType.PLAYLIST,
      "week",
      TOP_ITEMS_LIMIT,
      {},
    );

    topItems.users.value = { all_users: true };
    await flushPromises();
    expect(api.getTopItems).toHaveBeenLastCalledWith(
      MediaType.PLAYLIST,
      "week",
      TOP_ITEMS_LIMIT,
      { all_users: true },
    );
    expect(api.getTopItems).toHaveBeenCalledTimes(3);
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

describe("useStatisticsUsers", () => {
  const user = (user_id: string, display_name: string | null): User =>
    ({ user_id, username: user_id, display_name }) as User;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop());
  });

  function setupUsers() {
    const enabled = ref(false);
    const scope = effectScope();
    scopes.push(scope);
    return { enabled, ...scope.run(() => useStatisticsUsers(enabled))! };
  }

  it("loads once enabled, the current user first, then the others by name", async () => {
    api.getAllUsers.mockResolvedValue([
      user("homeassistant_system", null),
      user("bob", "Bob"),
      user("self", "Me Myself"),
      user("alice", "Alice"),
    ]);
    const statisticsUsers = setupUsers();
    await flushPromises();
    expect(api.getAllUsers).not.toHaveBeenCalled();

    statisticsUsers.enabled.value = true;
    await flushPromises();

    expect(statisticsUsers.users.value.map((u) => u.user_id)).toEqual([
      "self",
      "alice",
      "bob",
      "homeassistant_system",
    ]);
    expect(statisticsUsers.loaded.value).toBe(true);
  });

  it("toasts and still counts as loaded when the users can not be loaded", async () => {
    api.getAllUsers.mockRejectedValue(new Error("offline"));
    const statisticsUsers = setupUsers();
    statisticsUsers.enabled.value = true;
    await flushPromises();

    expect(toastError).toHaveBeenCalledExactlyOnceWith(
      "auth.users_load_failed",
    );
    expect(statisticsUsers.users.value).toEqual([]);
    expect(statisticsUsers.loaded.value).toBe(true);
  });
});
