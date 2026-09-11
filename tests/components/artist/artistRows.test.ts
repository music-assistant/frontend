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
  ARTIST_ROWS_PREFERENCE_KEY,
  ARTIST_ROW_SOURCES_PREFERENCE_KEY,
  artistRowDefinition,
  availableArtistRowIds,
  effectiveArtistRowSource,
  getArtistRowSource,
  resetArtistRows,
  resolveArtistRows,
  setArtistRowHidden,
  setArtistRowSource,
  setArtistRowsOrder,
  type ArtistRowId,
} from "@/components/artist/artistRows";
import { ArtistType, type ProviderMapping } from "@/plugins/api/interfaces";
import { artist } from "../../fixtures/artist";

const MUSIC_ROWS: ArtistRowId[] = [
  "bio",
  "top_tracks",
  "albums",
  "singles_eps",
  "appears_on",
  "similar_artists",
];

function setPreferences(preferences: Record<string, unknown>) {
  storeMock.currentUser = { preferences };
}

function mappedTo(providerInstance: string) {
  return artist({
    provider_mappings: [
      { provider_instance: providerInstance } as ProviderMapping,
    ],
  });
}

describe("artistRows", () => {
  beforeEach(() => {
    mockSetUserPreference.mockReset();
    setPreferences({});
  });

  describe("availableArtistRowIds", () => {
    it("offers the music rows to a singer and the audiobook rows to an author", () => {
      expect(availableArtistRowIds(false, false)).toEqual(MUSIC_ROWS);
      expect(availableArtistRowIds(true, false)).toEqual([
        "bio",
        "audiobooks",
        "audiobooks_all",
      ]);
    });

    it("adds the admin-only rows last for an admin", () => {
      expect(availableArtistRowIds(false, true)).toEqual([
        ...MUSIC_ROWS,
        "provider_mappings",
        "artwork",
      ]);
    });
  });

  describe("artistRowDefinition", () => {
    it("returns the row's label and source support", () => {
      expect(artistRowDefinition("albums")).toEqual({
        id: "albums",
        labelKey: "albums",
        audience: "music",
        supportsSource: true,
      });
    });
  });

  describe("resolveArtistRows", () => {
    it("returns the default order with nothing hidden without preferences", () => {
      const { order, hidden } = resolveArtistRows(MUSIC_ROWS);
      expect(order).toEqual(MUSIC_ROWS);
      expect(hidden.size).toBe(0);
    });

    it("applies the saved order and visibility", () => {
      setPreferences({
        [ARTIST_ROWS_PREFERENCE_KEY]: {
          hidden: ["appears_on"],
          order: ["albums", "bio", "top_tracks"],
        },
      });
      const { order, hidden } = resolveArtistRows(MUSIC_ROWS);
      // the rows the user never ordered follow their default sibling: albums
      expect(order).toEqual([
        "albums",
        "singles_eps",
        "appears_on",
        "similar_artists",
        "bio",
        "top_tracks",
      ]);
      expect(hidden).toEqual(new Set(["appears_on"]));
    });

    it("ignores rows that don't apply to this artist", () => {
      setPreferences({
        [ARTIST_ROWS_PREFERENCE_KEY]: {
          hidden: ["audiobooks"],
          order: ["audiobooks", "albums"],
        },
      });
      const { order, hidden } = resolveArtistRows(MUSIC_ROWS);
      expect(order).not.toContain("audiobooks");
      expect(hidden.size).toBe(0);
    });
  });

  describe("setArtistRowHidden / setArtistRowsOrder / resetArtistRows", () => {
    it("persists the hidden row", async () => {
      await setArtistRowHidden("appears_on", true);
      expect(mockSetUserPreference).toHaveBeenLastCalledWith(
        ARTIST_ROWS_PREFERENCE_KEY,
        expect.objectContaining({ hidden: ["appears_on"], shown: [] }),
      );
    });

    it("persists the new order", async () => {
      const reordered: ArtistRowId[] = [
        "albums",
        "bio",
        "top_tracks",
        "singles_eps",
        "appears_on",
        "similar_artists",
      ];
      await setArtistRowsOrder(reordered, MUSIC_ROWS);
      expect(mockSetUserPreference).toHaveBeenLastCalledWith(
        ARTIST_ROWS_PREFERENCE_KEY,
        expect.objectContaining({ order: reordered }),
      );
    });

    it("ignores an order containing unknown rows", async () => {
      await setArtistRowsOrder(["audiobooks"], MUSIC_ROWS);
      expect(mockSetUserPreference).not.toHaveBeenCalled();
    });

    it("clears both preferences", async () => {
      await resetArtistRows();
      expect(mockSetUserPreference).toHaveBeenCalledWith(
        ARTIST_ROWS_PREFERENCE_KEY,
        { hidden: [], shown: [], order: [] },
      );
      expect(mockSetUserPreference).toHaveBeenLastCalledWith(
        ARTIST_ROW_SOURCES_PREFERENCE_KEY,
        {},
      );
    });
  });

  describe("row sources", () => {
    it("reads and writes a single row's source", async () => {
      expect(getArtistRowSource("albums")).toBeUndefined();

      setPreferences({
        [ARTIST_ROW_SOURCES_PREFERENCE_KEY]: { albums: "spotify--abc" },
      });
      expect(getArtistRowSource("albums")).toBe("spotify--abc");

      await setArtistRowSource("top_tracks", "library");
      expect(mockSetUserPreference).toHaveBeenLastCalledWith(
        ARTIST_ROW_SOURCES_PREFERENCE_KEY,
        { albums: "spotify--abc", top_tracks: "library" },
      );

      await setArtistRowSource("albums", undefined);
      expect(mockSetUserPreference).toHaveBeenLastCalledWith(
        ARTIST_ROW_SOURCES_PREFERENCE_KEY,
        {},
      );
    });
  });

  describe("effectiveArtistRowSource", () => {
    it("defaults releases to every provider only when discography is supported", () => {
      const libraryArtist = artist();
      expect(effectiveArtistRowSource("albums", libraryArtist, true)).toBe(
        "all",
      );
      expect(
        effectiveArtistRowSource("singles_eps", libraryArtist, false),
      ).toBe("library");
    });

    it("defaults the server-aggregated rows to every provider", () => {
      expect(effectiveArtistRowSource("top_tracks", artist(), false)).toBe(
        "all",
      );
      expect(effectiveArtistRowSource("similar_artists", artist(), false)).toBe(
        "all",
      );
    });

    it("uses the saved source when the artist is mapped to it", () => {
      setPreferences({
        [ARTIST_ROW_SOURCES_PREFERENCE_KEY]: { albums: "spotify--abc" },
      });
      expect(
        effectiveArtistRowSource("albums", mappedTo("spotify--abc"), true),
      ).toBe("spotify--abc");
    });

    it("falls back to the default when the saved provider is gone", () => {
      setPreferences({
        [ARTIST_ROW_SOURCES_PREFERENCE_KEY]: { albums: "spotify--gone" },
      });
      expect(
        effectiveArtistRowSource("albums", mappedTo("spotify--abc"), true),
      ).toBe("all");
    });

    it("ignores a saved 'all' for release rows without discography support", () => {
      setPreferences({
        [ARTIST_ROW_SOURCES_PREFERENCE_KEY]: {
          albums: "all",
          top_tracks: "all",
        },
      });
      expect(effectiveArtistRowSource("albums", artist(), false)).toBe(
        "library",
      );
      expect(effectiveArtistRowSource("top_tracks", artist(), false)).toBe(
        "all",
      );
    });

    it("keeps a provider artist on its own provider", () => {
      setPreferences({
        [ARTIST_ROW_SOURCES_PREFERENCE_KEY]: { albums: "library" },
      });
      const providerArtist = artist({
        provider: "spotify--abc",
        artist_type: ArtistType.SINGER,
      });
      expect(effectiveArtistRowSource("albums", providerArtist, true)).toBe(
        "spotify--abc",
      );
    });
  });
});
