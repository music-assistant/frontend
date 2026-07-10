import { beforeEach, describe, expect, it, vi } from "vitest";

const { storeMock, mockSetUserPreference } = vi.hoisted(() => ({
  storeMock: {
    currentUser: null as { preferences?: Record<string, unknown> } | null,
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
  DISCOVER_ROWS_PREFERENCE_KEY,
  GENRES_ROW_ID,
  PLAYERS_ROW_ID,
  TOP_PICKS_ROW_ID,
  resolveDiscoverRowsConfig,
  setDiscoverRowHidden,
  setDiscoverRowsOrder,
  type DiscoverRowsConfig,
} from "@/components/discover/utils/discoverRows";

const ROW_A = "library://folder/in_progress";
const ROW_B = "library://folder/recently_played";
const ROW_C = "spotify--abc://folder/made_for_you";
const ROW_D = "spotify--abc://folder/new_releases";

// Default order as HomeWidgetRows builds it: well-known rows first, then the
// remaining server rows, genres pinned last.
const AVAILABLE = [
  PLAYERS_ROW_ID,
  TOP_PICKS_ROW_ID,
  ROW_A,
  ROW_B,
  ROW_C,
  ROW_D,
  GENRES_ROW_ID,
];

function setPreferences(preferences: Record<string, unknown>) {
  storeMock.currentUser = { preferences };
}

function lastWrittenConfig(): DiscoverRowsConfig {
  const call = mockSetUserPreference.mock.calls.at(-1);
  expect(call?.[0]).toBe(DISCOVER_ROWS_PREFERENCE_KEY);
  return call?.[1] as DiscoverRowsConfig;
}

describe("discoverRows (discover.rows preference)", () => {
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
    setPreferences({});
  });

  describe("resolveDiscoverRowsConfig", () => {
    it("returns the default order with nothing hidden without preferences", () => {
      const { order, hidden } = resolveDiscoverRowsConfig(AVAILABLE);
      expect(order).toEqual(AVAILABLE);
      expect(hidden.size).toBe(0);
    });

    it("applies the saved order and visibility", () => {
      const saved = [
        TOP_PICKS_ROW_ID,
        ROW_B,
        PLAYERS_ROW_ID,
        GENRES_ROW_ID,
        ROW_D,
        ROW_C,
        ROW_A,
      ];
      setPreferences({
        [DISCOVER_ROWS_PREFERENCE_KEY]: {
          hidden: [PLAYERS_ROW_ID, ROW_C],
          order: saved,
        },
      });
      const { order, hidden } = resolveDiscoverRowsConfig(AVAILABLE);
      expect(order).toEqual(saved);
      expect(hidden).toEqual(new Set([PLAYERS_ROW_ID, ROW_C]));
    });

    it("slots rows the user never ordered after their preceding default sibling", () => {
      setPreferences({
        [DISCOVER_ROWS_PREFERENCE_KEY]: {
          // user moved genres to the top, never saw ROW_D
          order: [
            GENRES_ROW_ID,
            PLAYERS_ROW_ID,
            TOP_PICKS_ROW_ID,
            ROW_A,
            ROW_B,
            ROW_C,
          ],
        },
      });
      const { order } = resolveDiscoverRowsConfig(AVAILABLE);
      // ROW_D's default position is right after ROW_C
      expect(order).toEqual([
        GENRES_ROW_ID,
        PLAYERS_ROW_ID,
        TOP_PICKS_ROW_ID,
        ROW_A,
        ROW_B,
        ROW_C,
        ROW_D,
      ]);
    });

    it("drops unavailable rows from the resolved order and hidden set", () => {
      setPreferences({
        [DISCOVER_ROWS_PREFERENCE_KEY]: {
          hidden: ["offline://folder/gone"],
          order: ["offline://folder/gone", ROW_B, ROW_A],
        },
      });
      const { order, hidden } = resolveDiscoverRowsConfig(AVAILABLE);
      expect(order).not.toContain("offline://folder/gone");
      expect(order).toContain(ROW_A);
      expect(hidden.size).toBe(0);
    });

    it("prefers the unified preference over legacy keys", () => {
      setPreferences({
        [DISCOVER_ROWS_PREFERENCE_KEY]: { hidden: [], order: [] },
        discoverPlayersEnabled: false,
      });
      const { hidden } = resolveDiscoverRowsConfig(AVAILABLE);
      expect(hidden.size).toBe(0);
    });
  });

  describe("legacy preference fallback", () => {
    it("maps the legacy enabled flags to hidden rows", () => {
      setPreferences({
        discoverPlayersEnabled: false,
        discoverGenresEnabled: false,
      });
      const { hidden } = resolveDiscoverRowsConfig(AVAILABLE);
      expect(hidden).toEqual(new Set([PLAYERS_ROW_ID, GENRES_ROW_ID]));
    });

    it("maps legacy row settings to order and visibility", () => {
      setPreferences({
        discoverRowSettings: {
          [ROW_C]: { position: 0, enabled: true },
          [ROW_A]: { position: 1, enabled: false },
        },
      });
      const { order, hidden } = resolveDiscoverRowsConfig(AVAILABLE);
      // players/top picks keep their legacy spots at the top and genres at
      // the bottom; ROW_D (never seen by the legacy settings) slots in right
      // after its default sibling ROW_C.
      expect(order).toEqual([
        PLAYERS_ROW_ID,
        TOP_PICKS_ROW_ID,
        ROW_C,
        ROW_D,
        ROW_A,
        ROW_B,
        GENRES_ROW_ID,
      ]);
      expect(hidden).toEqual(new Set([ROW_A]));
    });

    it("snapshots the legacy settings into the new format on first write", async () => {
      setPreferences({ discoverTopPicksEnabled: false });
      await setDiscoverRowHidden(ROW_A, true);
      expect(lastWrittenConfig().hidden).toEqual([TOP_PICKS_ROW_ID, ROW_A]);
    });
  });

  describe("setDiscoverRowHidden", () => {
    it("adds and removes a row from the hidden list", async () => {
      await setDiscoverRowHidden(ROW_B, true);
      expect(lastWrittenConfig().hidden).toEqual([ROW_B]);

      await setDiscoverRowHidden(ROW_B, false);
      expect(lastWrittenConfig().hidden).toEqual([]);
    });

    it("keeps hidden entries of currently unavailable rows", async () => {
      setPreferences({
        [DISCOVER_ROWS_PREFERENCE_KEY]: {
          hidden: ["offline://folder/gone"],
          order: [],
        },
      });
      await setDiscoverRowHidden(ROW_B, true);
      expect(lastWrittenConfig().hidden).toEqual([
        "offline://folder/gone",
        ROW_B,
      ]);
    });
  });

  describe("setDiscoverRowsOrder", () => {
    it("persists the new order of the available rows", async () => {
      const reordered = [
        TOP_PICKS_ROW_ID,
        PLAYERS_ROW_ID,
        ROW_A,
        ROW_B,
        ROW_C,
        ROW_D,
        GENRES_ROW_ID,
      ];
      await setDiscoverRowsOrder(reordered, AVAILABLE);
      expect(lastWrittenConfig().order).toEqual(reordered);
    });

    it("keeps unavailable rows in their saved slots", async () => {
      setPreferences({
        [DISCOVER_ROWS_PREFERENCE_KEY]: {
          hidden: [],
          // an offline provider's row sits between two available rows
          order: [ROW_A, "offline://folder/gone", ROW_B],
        },
      });
      const available = [ROW_A, ROW_B];
      await setDiscoverRowsOrder([ROW_B, ROW_A], available);
      expect(lastWrittenConfig().order).toEqual([
        ROW_B,
        "offline://folder/gone",
        ROW_A,
      ]);
    });

    it("ignores an order containing unknown rows", async () => {
      await setDiscoverRowsOrder(["bogus://row", ROW_A], [ROW_A]);
      expect(mockSetUserPreference).not.toHaveBeenCalled();
    });
  });
});
