import { beforeEach, describe, expect, it, vi } from "vitest";

const { storeMock, setUserPreferenceMock } = vi.hoisted(() => ({
  storeMock: {
    currentUser: null as { preferences?: Record<string, unknown> } | null,
  },
  setUserPreferenceMock: vi.fn(),
}));

vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/composables/userPreferences", () => ({
  setUserPreference: setUserPreferenceMock,
}));

import {
  GENRE_ROWS,
  GENRE_ROW_IDS,
  genreRows,
  type GenreRowId,
} from "@/components/genre/genreRows";

describe("genreRows", () => {
  beforeEach(() => {
    storeMock.currentUser = { preferences: {} };
    setUserPreferenceMock.mockReset();
  });

  it("defines the six traditional genre sections in their default order", () => {
    const rowIds: GenreRowId[] = [
      "artists",
      "albums",
      "tracks",
      "playlists",
      "podcasts",
      "audiobooks",
    ];

    expect(GENRE_ROWS.map((row) => row.id)).toEqual(rowIds);
    expect(GENRE_ROW_IDS).toEqual(rowIds);
    expect(genreRows.preferenceKey).toBe("genre.rows");
  });

  it("resolves the saved order and hidden rows against the genre sections", () => {
    storeMock.currentUser = {
      preferences: {
        "genre.rows": {
          order: ["tracks", "artists", "albums"],
          hidden: ["albums", "unknown"],
        },
      },
    };

    const { order, hidden } = genreRows.resolve(GENRE_ROW_IDS);

    expect(order).toEqual([
      "tracks",
      "playlists",
      "podcasts",
      "audiobooks",
      "artists",
      "albums",
    ]);
    expect(hidden).toEqual(new Set(["albums"]));
  });

  it("persists genre row visibility under the genre-specific preference", async () => {
    await genreRows.setHidden("tracks", true);

    expect(setUserPreferenceMock).toHaveBeenCalledWith(
      "genre.rows",
      expect.objectContaining({ hidden: ["tracks"], shown: [], order: [] }),
    );
  });
});
