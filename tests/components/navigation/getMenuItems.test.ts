import { beforeEach, describe, expect, it, vi } from "vitest";
import { MicVocal } from "@lucide/vue";

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

import {
  DEFAULT_MENU_ITEMS,
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

describe("getMenuItems (sidebar.menu preference)", () => {
  beforeEach(() => {
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

  it("shows everything in default order for users without any customization", () => {
    storeMock.enabledPlugins = new Set(["party", "music_quiz"]);

    expect(getIds()).toEqual(DEFAULT_MENU_ITEMS);
    expect(getMenuItems().filter((item) => item.hidden)).toEqual([]);
    expect(getMenuItems().find((item) => item.id === "music_quiz")?.icon).toBe(
      MicVocal,
    );
  });

  it("ignores the retired menu_items whitelist preferences", () => {
    // preferences written by pre-edit-mode frontends have no effect anymore
    setPreferences({
      menu_items: ["discover"],
      menu_items_seen: ["discover", "search", "browse"],
    });

    expect(getPaths()).toContain("/browse");
    expect(getPaths()).toContain("/artists");
    expect(getPaths()).toContain("/settings");
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

  it("hides items", async () => {
    await setMenuItemHidden("genres", true);

    const written = lastWrittenConfig();
    expect(written.hidden).toEqual(["genres"]);
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
