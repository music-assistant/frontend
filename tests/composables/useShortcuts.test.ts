import { MediaType } from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUpdateUser, storeMock } = vi.hoisted(() => {
  return {
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
    updateUser: mockUpdateUser,
  },
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

import {
  isShortcutPinned,
  isShortcutPinnedItem,
  pinShortcutStandalone,
  unpinShortcutStandaloneItem,
} from "@/composables/useShortcuts";

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
});
