import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MENU_ITEMS } from "@/constants";

const { storeMock } = vi.hoisted(() => ({
  storeMock: {
    currentUser: null as { preferences?: Record<string, unknown> } | null,
    enabledPlugins: new Set<string>(),
    libraryAudiobooksCount: 1,
    libraryPodcastsCount: 1,
  },
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

const localStorageMock = (() => {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    get length() {
      return values.size;
    },
  } satisfies Storage;
})();

vi.stubGlobal("localStorage", localStorageMock);

import { getMenuItems } from "@/components/navigation/utils/getMenuItems";

function getPaths() {
  return getMenuItems()
    .filter((item) => !item.hidden)
    .map((item) => item.path);
}

describe("getMenuItems", () => {
  beforeEach(() => {
    localStorageMock.clear();
    storeMock.enabledPlugins = new Set<string>();
    storeMock.libraryAudiobooksCount = 1;
    storeMock.libraryPodcastsCount = 1;
    storeMock.currentUser = { preferences: {} };
  });

  it("shows music quiz for legacy users when the plugin is enabled", () => {
    storeMock.enabledPlugins = new Set(["music_quiz"]);
    storeMock.currentUser = {
      preferences: {
        menu_items: DEFAULT_MENU_ITEMS.filter((item) => item !== "music_quiz"),
      },
    };

    expect(getPaths()).toContain("/music-quiz");
  });

  it("keeps legacy non-plugin removals hidden", () => {
    storeMock.enabledPlugins = new Set(["music_quiz"]);
    storeMock.currentUser = {
      preferences: {
        menu_items: DEFAULT_MENU_ITEMS.filter((item) => item !== "browse"),
      },
    };

    expect(getPaths()).not.toContain("/browse");
  });

  it("respects explicit removals once defaults are marked as seen", () => {
    storeMock.enabledPlugins = new Set(["music_quiz"]);
    storeMock.currentUser = {
      preferences: {
        menu_items: DEFAULT_MENU_ITEMS.filter((item) => item !== "music_quiz"),
        menu_items_seen: DEFAULT_MENU_ITEMS,
      },
    };

    expect(getPaths()).not.toContain("/music-quiz");
  });
});
