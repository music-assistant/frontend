import { MediaType } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";

const { mockGetItemByUri, mockSubscribe, mockUpdateUser, storeMock } =
  vi.hoisted(() => {
    return {
      mockGetItemByUri: vi.fn(),
      mockSubscribe: vi.fn(() => () => {}),
      mockUpdateUser: vi.fn(),
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
    getItemByUri: mockGetItemByUri,
    subscribe: mockSubscribe,
    updateUser: mockUpdateUser,
  },
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

import {
  getShortcutMoveAvailability,
  isShortcutPinned,
  isShortcutPinnedItem,
  moveShortcutStandaloneItem,
  pinShortcutStandalone,
  reorderShortcutStandalone,
  unpinShortcutStandaloneItem,
  useShortcuts,
} from "@/composables/useShortcuts";
import { ApiError } from "@/plugins/api/errors";

function mountShortcuts() {
  let shortcuts!: ReturnType<typeof useShortcuts>;
  const wrapper = mount(
    defineComponent({
      setup() {
        shortcuts = useShortcuts();
        return () => h("div");
      },
    }),
  );
  return { wrapper, shortcuts };
}

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

    const resolvedLibraryPodcast = {
      provider: "library",
      media_type: MediaType.PODCAST,
      item_id: "42",
      provider_mappings: [
        {
          item_id: PODCAST_FEED,
          provider_instance: "itunes_podcasts--abc123",
          provider_domain: "itunes_podcasts",
          available: true,
        },
      ],
    };

    expect(isShortcutPinnedItem(resolvedLibraryPodcast as any)).toBe(true);
  });

  it("removes pinned shortcut for resolved library podcast item", async () => {
    storeMock.currentUser.preferences["sidebar.shortcuts"] = [
      ENCODED_PODCAST_URI,
      "builtin://radio/http%3A%2F%2Fexample.com%2Fstream",
    ];

    const resolvedLibraryPodcast = {
      provider: "library",
      media_type: MediaType.PODCAST,
      item_id: "42",
      provider_mappings: [
        {
          item_id: PODCAST_FEED,
          provider_instance: "itunes_podcasts--abc123",
          provider_domain: "itunes_podcasts",
          available: true,
        },
      ],
    };

    await unpinShortcutStandaloneItem(resolvedLibraryPodcast as any);

    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(storeMock.currentUser.preferences["sidebar.shortcuts"]).toEqual([
      "builtin://radio/http%3A%2F%2Fexample.com%2Fstream",
    ]);
  });

  it("does not add duplicate when encoded variant is already pinned", async () => {
    storeMock.currentUser.preferences["sidebar.shortcuts"] = [
      ENCODED_PODCAST_URI,
    ];

    const podcastItem = {
      provider: "itunes_podcasts",
      media_type: MediaType.PODCAST,
      item_id: PODCAST_FEED,
      uri: RAW_PODCAST_URI,
    };

    await pinShortcutStandalone(podcastItem as any);

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

    const podcastItem = {
      provider: "itunes_podcasts",
      media_type: MediaType.PODCAST,
      item_id: PODCAST_FEED,
      uri: RAW_PODCAST_URI,
    };

    expect(getShortcutMoveAvailability(podcastItem as any)).toEqual({
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

    const podcastItem = {
      provider: "itunes_podcasts",
      media_type: MediaType.PODCAST,
      item_id: PODCAST_FEED,
      uri: RAW_PODCAST_URI,
    };

    await moveShortcutStandaloneItem(podcastItem as any, "down");

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

    const podcastItem = {
      provider: "itunes_podcasts",
      media_type: MediaType.PODCAST,
      item_id: PODCAST_FEED,
      uri: RAW_PODCAST_URI,
    };

    await moveShortcutStandaloneItem(podcastItem as any, "up");

    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(storeMock.currentUser.preferences["sidebar.shortcuts"]).toEqual([
      ENCODED_PODCAST_URI,
      "builtin://radio/http%3A%2F%2Fexample.com%2Fstream",
    ]);
  });
});

describe("useShortcuts stale shortcut pruning", () => {
  const ALIVE_URI = "library://playlist/99";
  const DELETED_URI = "library://playlist/123";
  const alivePlaylist = {
    provider: "library",
    media_type: MediaType.PLAYLIST,
    item_id: "99",
    uri: ALIVE_URI,
  };

  beforeEach(() => {
    mockUpdateUser.mockReset();
    mockGetItemByUri.mockReset();
    mockSubscribe.mockClear();
    storeMock.currentUser = {
      user_id: "user-1",
      preferences: {},
    };
  });

  it("resolves shortcuts with the global error toast suppressed", async () => {
    storeMock.currentUser.preferences["sidebar.shortcuts"] = [ALIVE_URI];
    mockGetItemByUri.mockResolvedValue(alivePlaylist);

    const { wrapper } = mountShortcuts();
    await flushPromises();
    wrapper.unmount();

    expect(mockGetItemByUri).toHaveBeenCalledWith(ALIVE_URI, {
      suppressErrorToast: true,
    });
  });

  it("prunes a pinned URI when the item no longer exists on the server", async () => {
    storeMock.currentUser.preferences["sidebar.shortcuts"] = [
      DELETED_URI,
      ALIVE_URI,
    ];
    mockGetItemByUri.mockImplementation((uri: string) =>
      uri === DELETED_URI
        ? Promise.reject(new ApiError(2, "playlist not found in library: 123"))
        : Promise.resolve(alivePlaylist),
    );

    const { wrapper, shortcuts } = mountShortcuts();
    await flushPromises();

    expect(storeMock.currentUser.preferences["sidebar.shortcuts"]).toEqual([
      ALIVE_URI,
    ]);
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(shortcuts.pinnedItems.value).toEqual([alivePlaylist]);
    wrapper.unmount();
  });

  it("keeps a pinned URI on transient (network/transport) errors", async () => {
    storeMock.currentUser.preferences["sidebar.shortcuts"] = [
      DELETED_URI,
      ALIVE_URI,
    ];
    mockGetItemByUri.mockImplementation((uri: string) =>
      uri === DELETED_URI
        ? Promise.reject(new Error("connection lost"))
        : Promise.resolve(alivePlaylist),
    );

    const { wrapper } = mountShortcuts();
    await flushPromises();

    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(storeMock.currentUser.preferences["sidebar.shortcuts"]).toEqual([
      DELETED_URI,
      ALIVE_URI,
    ]);
    wrapper.unmount();
  });
});
