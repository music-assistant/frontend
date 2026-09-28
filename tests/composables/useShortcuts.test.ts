import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  EventType,
  MediaType,
  type EventMessage,
} from "@/plugins/api/interfaces";

const { mockUpdateUser, mockSubscribe, mockGetItemByUri, storeMock } =
  vi.hoisted(() => {
    return {
      mockUpdateUser: vi.fn<MusicAssistantApi["updateUser"]>(),
      mockSubscribe: vi.fn<MusicAssistantApi["subscribe"]>(() => vi.fn()),
      mockGetItemByUri: vi.fn<MusicAssistantApi["getItemByUri"]>(),
      storeMock: {
        currentUser: {
          user_id: "user-1",
          preferences: {} as Record<string, unknown>,
        },
      },
    };
  });

vi.mock("@/plugins/api", () => ({
  api: {
    updateUser: mockUpdateUser,
    subscribe: mockSubscribe,
    getItemByUri: mockGetItemByUri,
  },
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

import {
  getShortcutMoveAvailability,
  useShortcuts,
  isShortcutPinned,
  isShortcutPinnedItem,
  moveShortcutStandaloneItem,
  pinShortcutStandalone,
  reorderShortcutStandalone,
  unpinShortcutStandaloneItem,
} from "@/composables/useShortcuts";
import { podcast } from "../fixtures/podcast";
import { providerMapping } from "../fixtures/providerMapping";
import { track } from "../fixtures/track";

const PODCAST_FEED = "https://ronzheimer.podigee.io/feed/mp3";
const ENCODED_PODCAST_URI = `itunes_podcasts://podcast/${encodeURIComponent(PODCAST_FEED)}`;
const RAW_PODCAST_URI = `itunes_podcasts://podcast/${PODCAST_FEED}`;

describe("useShortcuts standalone helpers", () => {
  beforeEach(() => {
    mockUpdateUser.mockReset();
    storeMock.currentUser = {
      user_id: "user-1",
      preferences: {},
    };
  });

  it("treats encoded and raw podcast URIs as the same pinned shortcut", () => {
    storeMock.currentUser.preferences["sidebar.shortcuts"] = [
      ENCODED_PODCAST_URI,
    ];

    expect(isShortcutPinned(RAW_PODCAST_URI)).toBe(true);
    expect(isShortcutPinned(ENCODED_PODCAST_URI)).toBe(true);
  });

  it("detects pinned state on resolved library item via provider mappings", () => {
    storeMock.currentUser.preferences["sidebar.shortcuts"] = [
      ENCODED_PODCAST_URI,
    ];

    const resolvedLibraryPodcast = podcast({
      provider_mappings: [
        providerMapping({
          item_id: PODCAST_FEED,
          provider_instance: "itunes_podcasts--abc123",
          provider_domain: "itunes_podcasts",
        }),
      ],
    });

    expect(isShortcutPinnedItem(resolvedLibraryPodcast)).toBe(true);
  });

  it("removes pinned shortcut for resolved library podcast item", async () => {
    storeMock.currentUser.preferences["sidebar.shortcuts"] = [
      ENCODED_PODCAST_URI,
      "builtin://radio/http%3A%2F%2Fexample.com%2Fstream",
    ];

    const resolvedLibraryPodcast = podcast({
      provider_mappings: [
        providerMapping({
          item_id: PODCAST_FEED,
          provider_instance: "itunes_podcasts--abc123",
          provider_domain: "itunes_podcasts",
        }),
      ],
    });

    await unpinShortcutStandaloneItem(resolvedLibraryPodcast);

    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(storeMock.currentUser.preferences["sidebar.shortcuts"]).toEqual([
      "builtin://radio/http%3A%2F%2Fexample.com%2Fstream",
    ]);
  });

  it("does not add duplicate when encoded variant is already pinned", async () => {
    storeMock.currentUser.preferences["sidebar.shortcuts"] = [
      ENCODED_PODCAST_URI,
    ];

    const podcastItem = podcast({
      provider: "itunes_podcasts",
      item_id: PODCAST_FEED,
      uri: RAW_PODCAST_URI,
    });

    await pinShortcutStandalone(podcastItem);

    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(storeMock.currentUser.preferences["sidebar.shortcuts"]).toEqual([
      ENCODED_PODCAST_URI,
    ]);
  });

  it("reorders shortcuts by URI match", async () => {
    storeMock.currentUser.preferences["sidebar.shortcuts"] = [
      ENCODED_PODCAST_URI,
      "builtin://radio/http%3A%2F%2Fexample.com%2Fstream",
      "library://playlist/99",
    ];

    await reorderShortcutStandalone("library://playlist/99", RAW_PODCAST_URI);

    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(storeMock.currentUser.preferences["sidebar.shortcuts"]).toEqual([
      "library://playlist/99",
      ENCODED_PODCAST_URI,
      "builtin://radio/http%3A%2F%2Fexample.com%2Fstream",
    ]);
  });

  it("does not update when reorder source is missing", async () => {
    storeMock.currentUser.preferences["sidebar.shortcuts"] = [
      ENCODED_PODCAST_URI,
      "builtin://radio/http%3A%2F%2Fexample.com%2Fstream",
    ];

    await reorderShortcutStandalone(
      "library://playlist/does-not-exist",
      "builtin://radio/http%3A%2F%2Fexample.com%2Fstream",
    );

    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(storeMock.currentUser.preferences["sidebar.shortcuts"]).toEqual([
      ENCODED_PODCAST_URI,
      "builtin://radio/http%3A%2F%2Fexample.com%2Fstream",
    ]);
  });

  it("returns move availability for pinned shortcut", () => {
    storeMock.currentUser.preferences["sidebar.shortcuts"] = [
      ENCODED_PODCAST_URI,
      "builtin://radio/http%3A%2F%2Fexample.com%2Fstream",
      "library://playlist/99",
    ];

    const podcastItem = podcast({
      provider: "itunes_podcasts",
      item_id: PODCAST_FEED,
      uri: RAW_PODCAST_URI,
    });

    expect(getShortcutMoveAvailability(podcastItem)).toEqual({
      canMoveUp: false,
      canMoveDown: true,
    });
  });

  it("moves pinned shortcut down by one position", async () => {
    storeMock.currentUser.preferences["sidebar.shortcuts"] = [
      ENCODED_PODCAST_URI,
      "builtin://radio/http%3A%2F%2Fexample.com%2Fstream",
      "library://playlist/99",
    ];

    const podcastItem = podcast({
      provider: "itunes_podcasts",
      item_id: PODCAST_FEED,
      uri: RAW_PODCAST_URI,
    });

    await moveShortcutStandaloneItem(podcastItem, "down");

    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(storeMock.currentUser.preferences["sidebar.shortcuts"]).toEqual([
      "builtin://radio/http%3A%2F%2Fexample.com%2Fstream",
      ENCODED_PODCAST_URI,
      "library://playlist/99",
    ]);
  });

  it("does not move when pinned shortcut is already at boundary", async () => {
    storeMock.currentUser.preferences["sidebar.shortcuts"] = [
      ENCODED_PODCAST_URI,
      "builtin://radio/http%3A%2F%2Fexample.com%2Fstream",
    ];

    const podcastItem = podcast({
      provider: "itunes_podcasts",
      item_id: PODCAST_FEED,
      uri: RAW_PODCAST_URI,
    });

    await moveShortcutStandaloneItem(podcastItem, "up");

    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(storeMock.currentUser.preferences["sidebar.shortcuts"]).toEqual([
      ENCODED_PODCAST_URI,
      "builtin://radio/http%3A%2F%2Fexample.com%2Fstream",
    ]);
  });
});

describe("useShortcuts media item subscription", () => {
  let shortcuts: ReturnType<typeof useShortcuts> | undefined;

  // the composable's hooks bind to whichever component calls it
  const Consumer = defineComponent({
    setup() {
      shortcuts = useShortcuts();
      return () => h("div");
    },
  });

  beforeEach(() => {
    mockSubscribe.mockClear();
    mockGetItemByUri.mockReset();
    shortcuts = undefined;
    storeMock.currentUser = { user_id: "user-1", preferences: {} };
  });

  /** The handler the composable registered for the user's own favorite changes. */
  function favoriteUpdateHandler() {
    const call = mockSubscribe.mock.calls.find(
      ([type]) => type === EventType.FAVORITE_UPDATED,
    );
    expect(
      call,
      "the composable listens for the favorite updates",
    ).toBeDefined();
    return call![1] as (evt: EventMessage) => void;
  }

  it("stops listening when its component goes away", async () => {
    const consumer = mount(Consumer);
    await flushPromises();
    const unsubscribes = mockSubscribe.mock.results.map((r) => r.value);
    // the media item events and the user's own favorite changes
    expect(unsubscribes).toHaveLength(2);

    consumer.unmount();

    for (const unsubscribe of unsubscribes)
      expect(unsubscribe).toHaveBeenCalled();
  });

  // a like or dislike made elsewhere leaves the pinned copy behind otherwise
  it("shows the user's own favorite change on a pinned item", async () => {
    const pinned = track({ item_id: "1", favorite: null });
    storeMock.currentUser.preferences["sidebar.shortcuts"] = [pinned.uri];
    mockGetItemByUri.mockResolvedValue(pinned);
    mount(Consumer);
    await flushPromises();

    favoriteUpdateHandler()({
      event: EventType.FAVORITE_UPDATED,
      object_id: pinned.uri,
      data: {
        uri: pinned.uri,
        media_type: MediaType.TRACK,
        item_id: "1",
        favorite: false,
        user_id: "user-1",
      },
    } as EventMessage);

    expect(shortcuts?.pinnedItems.value[0]?.favorite).toBe(false);
  });

  it("never starts listening when its component goes away during startup", async () => {
    const consumer = mount(Consumer);

    consumer.unmount();
    await flushPromises();

    expect(mockSubscribe).not.toHaveBeenCalled();
  });
});
