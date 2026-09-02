import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import type { MusicAssistantApi } from "@/plugins/api";

const { mockUpdateUser, mockSubscribe, mockGetItemByUri, storeMock } =
  vi.hoisted(() => {
    return {
      mockUpdateUser: vi.fn<MusicAssistantApi["updateUser"]>(),
      mockSubscribe: vi.fn(() => vi.fn()),
      mockGetItemByUri: vi.fn(),
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
  getShortcutUri,
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
  // the composable's hooks bind to whichever component calls it
  let shortcutState!: ReturnType<typeof useShortcuts>;
  const Consumer = defineComponent({
    setup() {
      shortcutState = useShortcuts();
      return () => h("div");
    },
  });

  beforeEach(() => {
    mockSubscribe.mockClear();
    mockGetItemByUri.mockReset();
    storeMock.currentUser = { user_id: "user-1", preferences: {} };
  });

  it("stops listening when its component goes away", async () => {
    const consumer = mount(Consumer);
    await flushPromises();
    const [unsubscribe] = mockSubscribe.mock.results.map((r) => r.value);
    expect(unsubscribe).toBeDefined();

    consumer.unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it("never starts listening when its component goes away during startup", async () => {
    const consumer = mount(Consumer);

    consumer.unmount();
    await flushPromises();

    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it("filters hidden shortcuts normally and exposes them while editing", async () => {
    const item = podcast();
    const uri = getShortcutUri(item);
    storeMock.currentUser.preferences = {
      "sidebar.shortcuts": [uri],
      "sidebar.hidden_shortcuts": [uri],
    };
    mockGetItemByUri.mockResolvedValue(item);

    const consumer = mount(Consumer);
    await flushPromises();

    expect(shortcutState.pinnedItems.value).toHaveLength(1);
    expect(shortcutState.visiblePinnedItems.value).toHaveLength(0);
    expect(shortcutState.isShortcutHidden(uri)).toBe(true);

    await shortcutState.toggleShortcutHidden(uri);
    await flushPromises();
    expect(
      storeMock.currentUser.preferences["sidebar.hidden_shortcuts"],
    ).toEqual([]);

    consumer.unmount();
    const restoredConsumer = mount(Consumer);
    await flushPromises();
    expect(shortcutState.visiblePinnedItems.value).toHaveLength(1);

    restoredConsumer.unmount();
  });

  it("removes hidden state when a shortcut is unpinned", async () => {
    const item = podcast();
    const uri = getShortcutUri(item);
    storeMock.currentUser.preferences = {
      "sidebar.shortcuts": [uri],
      "sidebar.hidden_shortcuts": [uri],
    };

    await unpinShortcutStandaloneItem(item);

    expect(storeMock.currentUser.preferences["sidebar.shortcuts"]).toEqual([]);
    expect(
      storeMock.currentUser.preferences["sidebar.hidden_shortcuts"],
    ).toEqual([]);
  });
});
