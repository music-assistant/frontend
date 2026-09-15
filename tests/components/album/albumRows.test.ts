import { beforeEach, describe, expect, it, vi } from "vitest";

const { storeMock, mockSetUserPreference } = vi.hoisted(() => ({
  storeMock: {
    currentUser: null as { preferences?: Record<string, unknown> } | null,
  },
  mockSetUserPreference: vi.fn(),
}));

vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/api", () => ({ api: { providers: {} } }));
vi.mock("@/composables/userPreferences", () => ({
  setUserPreference: mockSetUserPreference,
}));

import {
  ALBUM_ROWS_PREFERENCE_KEY,
  albumRows,
  availableAlbumRowIds,
  type AlbumRowId,
} from "@/components/album/albumRows";

const ALL_ROWS: AlbumRowId[] = [
  "tracks",
  "review",
  "other_versions",
  "more_from_artist",
  "provider_mappings",
  "artwork",
];

describe("albumRows", () => {
  beforeEach(() => {
    storeMock.currentUser = null;
    mockSetUserPreference.mockReset();
  });

  describe("availableAlbumRowIds", () => {
    it("keeps the artwork row for whoever manages the library", () => {
      expect(availableAlbumRowIds(true)).toEqual(ALL_ROWS);
    });

    it("hides it from everyone else", () => {
      expect(availableAlbumRowIds(false)).toEqual(
        ALL_ROWS.filter((row) => row !== "artwork"),
      );
    });
  });

  describe("resolve", () => {
    it("shows every row in its default order until the user says otherwise", () => {
      const { order, hidden } = albumRows.resolve(ALL_ROWS);

      expect(order).toEqual(ALL_ROWS);
      expect(hidden.size).toBe(0);
    });

    it("follows the order and hidden rows the user saved", () => {
      storeMock.currentUser = {
        preferences: {
          [ALBUM_ROWS_PREFERENCE_KEY]: {
            order: ["review", "tracks"],
            hidden: ["other_versions"],
          },
        },
      };

      const { order, hidden } = albumRows.resolve(ALL_ROWS);

      expect(order.indexOf("review")).toBeLessThan(order.indexOf("tracks"));
      expect(order).toHaveLength(ALL_ROWS.length);
      expect(hidden.has("other_versions")).toBe(true);
    });
  });

  // an album is only ever listed by the provider it came from, so no row of
  // this page offers a source to pick
  it("offers no source picker", () => {
    for (const row of ALL_ROWS) {
      expect(albumRows.sources(row, {} as never)).toEqual([]);
    }
  });
});
