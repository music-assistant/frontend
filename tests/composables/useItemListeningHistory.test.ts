import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, ref, type EffectScope } from "vue";
import {
  HISTORY_PAGE_SIZE,
  useItemListeningHistory,
} from "@/composables/useItemListeningHistory";
import {
  MediaType,
  type MediaItemType,
  type PlayHistoryItem,
  type Track,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";

const { api, toastError, unsubscribe } = vi.hoisted(() => ({
  api: {
    state: { value: "initialized" },
    subscribe: vi.fn(),
    getPlayCount: vi.fn(),
    getPlayHistory: vi.fn(),
    getPlaysOverTime: vi.fn(),
  },
  toastError: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("@/plugins/api", () => ({
  default: api,
  ConnectionState: { INITIALIZED: "initialized" },
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-sonner", () => ({ toast: { error: toastError } }));
vi.mock("@/plugins/store", async () => {
  const { reactive } = await import("vue");
  return {
    store: reactive({ currentUser: { user_id: "self", preferences: {} } }),
  };
});
vi.mock("@/composables/userPreferences", async () => {
  const { computed } = await import("vue");
  const { store } = await import("@/plugins/store");
  return {
    useUserPreferences: () => ({
      getPreference: <T>(key: string, fallback: T) =>
        computed(
          () =>
            (store.currentUser?.preferences?.[key] as T | undefined) ??
            fallback,
        ),
    }),
  };
});

const track: Track = {
  item_id: "1",
  provider: "library",
  media_type: MediaType.TRACK,
  name: "Track",
  uri: "library://track/1",
  version: "",
  external_ids: [],
  is_playable: true,
  provider_mappings: [],
  metadata: {},
  duration: 180,
  artists: [],
  disc_number: 1,
  track_number: 1,
};
function event(id: number): PlayHistoryItem {
  return {
    item_id: "1",
    provider: "library",
    media_type: MediaType.TRACK,
    name: "Track",
    uri: track.uri,
    version: "",
    external_ids: [],
    is_playable: true,
    available: true,
    event_id: id,
    played_at: 1_000,
    artists: [],
  };
}
const scopes: EffectScope[] = [];
function setup() {
  const item = ref<MediaItemType>({ ...track });
  const scope = effectScope();
  scopes.push(scope);
  const history = scope.run(() => useItemListeningHistory(item))!;
  return { item, ...history };
}

beforeEach(() => {
  vi.resetAllMocks();
  store.currentUser!.user_id = "self";
  store.currentUser!.preferences = {};
  api.getPlayCount.mockResolvedValue(48);
  api.getPlaysOverTime.mockResolvedValue([
    { timestamp: "2026-11-09", value: 3 },
  ]);
  api.getPlayHistory.mockResolvedValue(
    Array.from({ length: HISTORY_PAGE_SIZE + 1 }, (_, index) => event(index)),
  );
  api.subscribe.mockReturnValue(unsubscribe);
});
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop());
  vi.restoreAllMocks();
});

describe("personal item listening history", () => {
  it("loads the personal total and month trend, but no events before the dialog opens", async () => {
    const history = setup();
    await flushPromises();
    expect(history.count.value).toBe(48);
    expect(api.getPlayCount).toHaveBeenCalledWith({
      item_id: "1",
      provider: "library",
      media_type: MediaType.TRACK,
    });
    expect(api.getPlayHistory).not.toHaveBeenCalled();
    history.open.value = true;
    await flushPromises();
    expect(history.entries.value).toHaveLength(HISTORY_PAGE_SIZE);
    expect(history.hasMore.value).toBe(true);
    api.getPlayHistory.mockResolvedValue([event(21)]);
    await history.loadMore();
    expect(api.getPlayHistory).toHaveBeenLastCalledWith(
      expect.anything(),
      "month",
      HISTORY_PAGE_SIZE + 1,
      HISTORY_PAGE_SIZE,
    );
    expect(history.entries.value.at(-1)?.event_id).toBe(21);
    expect(history.hasMore.value).toBe(false);
  });

  it("does not request hidden statistics and resets the dialog when the account changes", async () => {
    store.currentUser!.preferences = { listeningHistory: { track: false } };
    const history = setup();
    await flushPromises();
    expect(api.getPlayCount).not.toHaveBeenCalled();
    store.currentUser!.preferences = {};
    await flushPromises();
    history.open.value = true;
    await flushPromises();
    store.currentUser!.user_id = "other";
    await flushPromises();
    expect(history.open.value).toBe(false);
    expect(history.entries.value).toEqual([]);
  });

  it("does not apply a late page after changing the selected period", async () => {
    const history = setup();
    history.open.value = true;
    await flushPromises();
    let resolvePage!: (value: PlayHistoryItem[]) => void;
    api.getPlayHistory.mockReturnValueOnce(
      new Promise<PlayHistoryItem[]>((resolve) => {
        resolvePage = resolve;
      }),
    );
    const page = history.loadMore();
    history.period.value = "week";
    await flushPromises();
    resolvePage([event(100)]);
    await page;
    expect(history.entries.value.some((entry) => entry.event_id === 100)).toBe(
      false,
    );
    expect(api.getPlayHistory).toHaveBeenLastCalledWith(
      expect.anything(),
      "week",
      HISTORY_PAGE_SIZE + 1,
    );
  });

  it("surfaces load errors rather than displaying a false zero total", async () => {
    api.getPlayCount.mockRejectedValue(new Error("API unavailable"));
    const history = setup();
    await flushPromises();
    expect(history.failed.value).toBe(true);
    expect(history.count.value).toBeNull();
  });
});
