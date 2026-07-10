import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MENU_ITEMS } from "@/constants";

const { storeMock, mockSetUserPreference } = vi.hoisted(() => ({
  storeMock: {
    currentUser: null as { preferences?: Record<string, unknown> } | null,
    enabledPlugins: new Set<string>(),
    libraryAudiobooksCount: 1,
    libraryPodcastsCount: 1,
  },
  mockSetUserPreference: vi.fn(),
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("@/composables/userPreferences", () => ({
  setUserPreference: mockSetUserPreference,
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

import {
  getMenuItems,
  MENU_PREFERENCE_KEY,
  resolveMenuConfig,
  setMenuItemHidden,
  setMenuItemsOrder,
  updateMenuSectionConfig,
  type MenuConfig,
} from "@/components/navigation/utils/getMenuItems";

function getPaths() {
  return getMenuItems()
    .filter((item) => !item.hidden)
    .map((item) => item.path);
}

function getIds() {
  return getMenuItems().map((item) => item.id);
}

function setPreferences(preferences: Record<string, unknown>) {
  storeMock.currentUser = { preferences };
}

function lastWrittenConfig(): MenuConfig {
  const call = mockSetUserPreference.mock.calls.at(-1);
  expect(call?.[0]).toBe(MENU_PREFERENCE_KEY);
  return call?.[1] as MenuConfig;
}

describe("getMenuItems (legacy whitelist fallback)", () => {
  beforeEach(() => {
    localStorageMock.clear();
    mockSetUserPreference.mockReset();
    storeMock.enabledPlugins = new Set<string>();
    storeMock.libraryAudiobooksCount = 1;
    storeMock.libraryPodcastsCount = 1;
    storeMock.currentUser = { preferences: {} };
  });

  it("shows music quiz for legacy users when the plugin is enabled", () => {
    storeMock.enabledPlugins = new Set(["music_quiz"]);
    setPreferences({
      menu_items: DEFAULT_MENU_ITEMS.filter((item) => item !== "music_quiz"),
    });

    expect(getPaths()).toContain("/music-quiz");
  });

  it("keeps legacy non-plugin removals hidden", () => {
    storeMock.enabledPlugins = new Set(["music_quiz"]);
    setPreferences({
      menu_items: DEFAULT_MENU_ITEMS.filter((item) => item !== "browse"),
    });

    expect(getPaths()).not.toContain("/browse");
  });

  it("respects explicit removals once defaults are marked as seen", () => {
    storeMock.enabledPlugins = new Set(["music_quiz"]);
    setPreferences({
      menu_items: DEFAULT_MENU_ITEMS.filter((item) => item !== "music_quiz"),
      menu_items_seen: DEFAULT_MENU_ITEMS,
    });

    expect(getPaths()).not.toContain("/music-quiz");
  });

  it("shows everything for users without any customization", () => {
    expect(getPaths()).toEqual(
      DEFAULT_MENU_ITEMS.filter(
        (id) => id !== "party" && id !== "music_quiz",
      ).map((id) => getMenuItems().find((item) => item.id === id)!.path),
    );
  });

  it("derives nothing hidden from a full whitelist saved in arbitrary order", () => {
    // real-world state: whitelist saved by an older frontend (reversed order,
    // no music_quiz yet), no menu_items_seen
    storeMock.enabledPlugins = new Set(["party", "music_quiz"]);
    setPreferences({
      menu_items: [
        "settings",
        "browse",
        "genres",
        "radios",
        "podcasts",
        "audiobooks",
        "playlists",
        "tracks",
        "albums",
        "artists",
        "party",
        "search",
        "discover",
      ],
    });

    expect(getMenuItems().filter((item) => item.hidden)).toEqual([]);
    expect(getPaths()).toContain("/music-quiz");
  });

  it.each([
    ["null", null],
    ["an empty string", ""],
    ["an empty array", []],
    ["a double-encoded json string", '["settings","browse","artists"]'],
    ["ids from another frontend version", ["home", "queue", "config"]],
    ["a plugin-only list", ["party", "music_quiz"]],
  ])("ignores a legacy whitelist that is %s", (_desc, value) => {
    storeMock.enabledPlugins = new Set(["party", "music_quiz"]);
    setPreferences({
      menu_items: value,
      menu_items_seen: DEFAULT_MENU_ITEMS,
    });

    // A whitelist matching no standard items would hide the whole menu:
    // treat it as garbage and show the defaults instead.
    expect(getMenuItems().filter((item) => item.hidden)).toEqual([]);
    expect(getPaths()).toContain("/discover");
    expect(getPaths()).toContain("/artists");
    expect(getPaths()).toContain("/settings");
  });

  it("still honors a sparse but valid whitelist", () => {
    setPreferences({
      menu_items: ["discover", "artists", "settings"],
      menu_items_seen: DEFAULT_MENU_ITEMS,
    });

    expect(getPaths()).toEqual(["/discover", "/artists", "/settings"]);
  });
});

describe("getMenuItems (sidebar.menu preference)", () => {
  beforeEach(() => {
    localStorageMock.clear();
    mockSetUserPreference.mockReset();
    mockSetUserPreference.mockImplementation(
      async (key: string, value: unknown) => {
        // emulate the optimistic local update of setUserPreference
        if (storeMock.currentUser) {
          storeMock.currentUser.preferences = {
            ...storeMock.currentUser.preferences,
            [key]: value,
          };
        }
      },
    );
    storeMock.enabledPlugins = new Set<string>();
    storeMock.libraryAudiobooksCount = 1;
    storeMock.libraryPodcastsCount = 1;
    storeMock.currentUser = { preferences: {} };
  });

  it("hides opted-out items but keeps them listed for edit mode", () => {
    setPreferences({
      [MENU_PREFERENCE_KEY]: { hidden: ["genres", "radios"] },
    });

    expect(getPaths()).not.toContain("/genres");
    expect(getPaths()).not.toContain("/radios");
    const genres = getMenuItems().find((item) => item.id === "genres");
    expect(genres?.hidden).toBe(true);
  });

  it("takes precedence over legacy whitelist preferences", () => {
    setPreferences({
      // Legacy whitelist says only discover is enabled...
      menu_items: ["discover"],
      menu_items_seen: DEFAULT_MENU_ITEMS,
      // ...but the new model hides nothing.
      [MENU_PREFERENCE_KEY]: { hidden: [] },
    });

    expect(getPaths()).toContain("/browse");
    expect(getPaths()).toContain("/artists");
  });

  it("applies the saved order", () => {
    setPreferences({
      [MENU_PREFERENCE_KEY]: {
        order: [
          "search",
          "discover",
          ...DEFAULT_MENU_ITEMS.filter(
            (id) => id !== "search" && id !== "discover",
          ),
        ],
      },
    });

    expect(getIds().slice(0, 2)).toEqual(["search", "discover"]);
  });

  it("slots newly added items at their default relative position", () => {
    storeMock.enabledPlugins = new Set(["music_quiz", "party"]);
    setPreferences({
      [MENU_PREFERENCE_KEY]: {
        // saved before music_quiz existed; party was moved to the top
        order: DEFAULT_MENU_ITEMS.filter((id) => id !== "music_quiz").sort(
          (a, b) => (a === "party" ? -1 : b === "party" ? 1 : 0),
        ),
      },
    });

    const order = resolveMenuConfig().order;
    // music_quiz follows its default predecessor (party), wherever that is
    expect(order.indexOf("music_quiz")).toBe(order.indexOf("party") + 1);
  });

  it("drops stale ids from hidden and order", () => {
    setPreferences({
      [MENU_PREFERENCE_KEY]: {
        hidden: ["bogus", "genres"],
        order: ["bogus", ...DEFAULT_MENU_ITEMS],
      },
    });

    const cfg = resolveMenuConfig();
    expect(cfg.hidden.has("bogus")).toBe(false);
    expect(cfg.order).toEqual(DEFAULT_MENU_ITEMS);
  });

  it("excludes plugin items entirely when the plugin is unavailable", () => {
    setPreferences({ [MENU_PREFERENCE_KEY]: {} });

    expect(getIds()).not.toContain("party");
    expect(getIds()).not.toContain("music_quiz");
  });

  it("materializes the legacy state on the first edit", async () => {
    setPreferences({
      menu_items: DEFAULT_MENU_ITEMS.filter((item) => item !== "browse"),
      menu_items_seen: DEFAULT_MENU_ITEMS,
    });

    await setMenuItemHidden("genres", true);

    const written = lastWrittenConfig();
    expect(written.hidden).toContain("browse");
    expect(written.hidden).toContain("genres");
    expect(written.order).toEqual(DEFAULT_MENU_ITEMS);
  });

  it("unhides items", async () => {
    setPreferences({
      [MENU_PREFERENCE_KEY]: { hidden: ["genres"] },
    });

    await setMenuItemHidden("genres", false);

    expect(lastWrittenConfig().hidden).toEqual([]);
  });

  it("reorders a subset within its existing slots", async () => {
    setPreferences({ [MENU_PREFERENCE_KEY]: {} });

    // swap artists and albums; everything else keeps its position
    await setMenuItemsOrder(["albums", "artists"]);

    const written = lastWrittenConfig();
    const expected = [...DEFAULT_MENU_ITEMS];
    const artistsIndex = expected.indexOf("artists");
    const albumsIndex = expected.indexOf("albums");
    expected[artistsIndex] = "albums";
    expected[albumsIndex] = "artists";
    expect(written.order).toEqual(expected);
  });

  it("merges section config updates", async () => {
    setPreferences({
      [MENU_PREFERENCE_KEY]: {
        sections: { library: { label: "My Music" } },
      },
    });

    await updateMenuSectionConfig("library", { hide_label: true });

    expect(lastWrittenConfig().sections?.library).toEqual({
      label: "My Music",
      hide_label: true,
    });
  });

  it("clears a section config when reset to defaults", async () => {
    setPreferences({
      [MENU_PREFERENCE_KEY]: {
        sections: { library: { label: "My Music" } },
      },
    });

    await updateMenuSectionConfig("library", { label: undefined });

    expect(lastWrittenConfig().sections?.library).toBeUndefined();
  });
});
