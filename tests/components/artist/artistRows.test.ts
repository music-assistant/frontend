import { beforeEach, describe, expect, it, vi } from "vitest";

const { storeMock, mockSetUserPreference, providersMock } = vi.hoisted(() => ({
  storeMock: {
    currentUser: null as { preferences?: Record<string, unknown> } | null,
  },
  mockSetUserPreference: vi.fn(),
  providersMock: {} as Record<string, unknown>,
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("@/plugins/api", () => ({
  api: { providers: providersMock },
}));

vi.mock("@/composables/userPreferences", () => ({
  setUserPreference: mockSetUserPreference,
}));

import {
  ARTIST_ROWS_PREFERENCE_KEY,
  ARTIST_ROW_SOURCES_PREFERENCE_KEY,
  artistRows,
  availableArtistRowIds,
  type ArtistRowId,
} from "@/components/artist/artistRows";
import {
  ArtistType,
  ProviderFeature,
  ProviderType,
  type ProviderMapping,
} from "@/plugins/api/interfaces";
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

function mappedTo(...providerInstances: string[]) {
  return artist({
    provider_mappings: providerInstances.map(
      (provider_instance) => ({ provider_instance }) as ProviderMapping,
    ),
  });
}

// registers a loaded provider instance with the given capabilities
function addProvider(
  instanceId: string,
  features: ProviderFeature[],
  type = ProviderType.MUSIC,
) {
  providersMock[instanceId] = {
    instance_id: instanceId,
    name: instanceId,
    domain: instanceId.split("--")[0],
    type,
    supported_features: features,
  };
}

describe("artistRows", () => {
  beforeEach(() => {
    mockSetUserPreference.mockReset();
    setPreferences({});
    for (const key of Object.keys(providersMock)) delete providersMock[key];
  });

  describe("availableArtistRowIds", () => {
    it("offers the music rows to a singer and the audiobook rows to an author", () => {
      expect(availableArtistRowIds(false, false)).toEqual([
        ...MUSIC_ROWS,
        "provider_mappings",
      ]);
      expect(availableArtistRowIds(true, false)).toEqual([
        "bio",
        "audiobooks",
        "audiobooks_all",
        "provider_mappings",
      ]);
    });

    it("adds the artwork row last for an admin", () => {
      expect(availableArtistRowIds(false, true)).toEqual([
        ...MUSIC_ROWS,
        "provider_mappings",
        "artwork",
      ]);
    });
  });

  describe("sources", () => {
    it("lists the library and the capable providers for a release row, never every provider at once", () => {
      addProvider("spotify--abc", [ProviderFeature.ARTIST_ALBUMS]);
      addProvider("tidal--def", []);
      expect(
        artistRows.sources("albums", mappedTo("spotify--abc", "tidal--def")),
      ).toEqual(["library", "spotify--abc"]);
    });

    it("adds capable metadata providers to the aggregated rows, without the library", () => {
      addProvider("spotify--abc", [ProviderFeature.SIMILAR_ARTISTS]);
      addProvider(
        "lastfm--ghi",
        [ProviderFeature.SIMILAR_ARTISTS],
        ProviderType.METADATA,
      );
      expect(
        artistRows.sources("similar_artists", mappedTo("spotify--abc")),
      ).toEqual(["all", "lastfm--ghi", "spotify--abc"]);
    });

    it("offers nothing for a provider artist or a row without a picker", () => {
      addProvider("spotify--abc", [ProviderFeature.ARTIST_ALBUMS]);
      const providerArtist = artist({ provider: "spotify--abc" });
      expect(artistRows.sources("albums", providerArtist)).toEqual([]);
      expect(
        artistRows.sources("appears_on", mappedTo("spotify--abc")),
      ).toEqual([]);
    });
  });

  describe("definition", () => {
    it("returns the row's label and source support", () => {
      expect(artistRows.definition("albums")).toEqual({
        id: "albums",
        labelKey: "albums",
        audience: "music",
        supportsSource: true,
      });
    });
  });

  describe("resolve", () => {
    it("returns the default order with nothing hidden without preferences", () => {
      const { order, hidden } = artistRows.resolve(MUSIC_ROWS);
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
      const { order, hidden } = artistRows.resolve(MUSIC_ROWS);
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
      const { order, hidden } = artistRows.resolve(MUSIC_ROWS);
      expect(order).not.toContain("audiobooks");
      expect(hidden.size).toBe(0);
    });
  });

  describe("setHidden / setOrder / reset", () => {
    it("persists the hidden row", async () => {
      await artistRows.setHidden("appears_on", true);
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
      await artistRows.setOrder(reordered, MUSIC_ROWS);
      expect(mockSetUserPreference).toHaveBeenLastCalledWith(
        ARTIST_ROWS_PREFERENCE_KEY,
        expect.objectContaining({ order: reordered }),
      );
    });

    it("ignores an order containing unknown rows", async () => {
      await artistRows.setOrder(["audiobooks"], MUSIC_ROWS);
      expect(mockSetUserPreference).not.toHaveBeenCalled();
    });

    it("clears both preferences", async () => {
      await artistRows.reset();
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
      expect(artistRows.getSource("albums")).toBeUndefined();

      setPreferences({
        [ARTIST_ROW_SOURCES_PREFERENCE_KEY]: { albums: "spotify--abc" },
      });
      expect(artistRows.getSource("albums")).toBe("spotify--abc");

      await artistRows.setSource("top_tracks", "library");
      expect(mockSetUserPreference).toHaveBeenLastCalledWith(
        ARTIST_ROW_SOURCES_PREFERENCE_KEY,
        { albums: "spotify--abc", top_tracks: "library" },
      );

      await artistRows.setSource("albums", undefined);
      expect(mockSetUserPreference).toHaveBeenLastCalledWith(
        ARTIST_ROW_SOURCES_PREFERENCE_KEY,
        {},
      );
    });
  });

  describe("effectiveSource", () => {
    it("defaults the release rows to the library", () => {
      const libraryArtist = artist();
      expect(artistRows.effectiveSource("albums", libraryArtist)).toBe(
        "library",
      );
      expect(artistRows.effectiveSource("singles_eps", libraryArtist)).toBe(
        "library",
      );
    });

    it("defaults the server-aggregated rows to every provider", () => {
      expect(artistRows.effectiveSource("top_tracks", artist())).toBe("all");
      expect(artistRows.effectiveSource("similar_artists", artist())).toBe(
        "all",
      );
    });

    it("uses the saved source when a mapped provider can supply the row", () => {
      setPreferences({
        [ARTIST_ROW_SOURCES_PREFERENCE_KEY]: { albums: "spotify--abc" },
      });
      addProvider("spotify--abc", [ProviderFeature.ARTIST_ALBUMS]);
      expect(
        artistRows.effectiveSource("albums", mappedTo("spotify--abc")),
      ).toBe("spotify--abc");
    });

    it("falls back to the default when the saved provider lacks the row's feature", () => {
      setPreferences({
        [ARTIST_ROW_SOURCES_PREFERENCE_KEY]: { top_tracks: "spotify--abc" },
      });
      addProvider("spotify--abc", [ProviderFeature.ARTIST_ALBUMS]);
      expect(
        artistRows.effectiveSource("top_tracks", mappedTo("spotify--abc")),
      ).toBe("all");
    });

    it("falls back to the default when the saved provider is gone", () => {
      setPreferences({
        [ARTIST_ROW_SOURCES_PREFERENCE_KEY]: { albums: "spotify--gone" },
      });
      expect(
        artistRows.effectiveSource("albums", mappedTo("spotify--abc")),
      ).toBe("library");
    });

    it("ignores an 'all' saved for a release row while the discography existed", () => {
      setPreferences({
        [ARTIST_ROW_SOURCES_PREFERENCE_KEY]: {
          albums: "all",
          top_tracks: "all",
        },
      });
      expect(artistRows.effectiveSource("albums", artist())).toBe("library");
      expect(artistRows.effectiveSource("top_tracks", artist())).toBe("all");
    });

    it("keeps a provider artist on its own provider", () => {
      setPreferences({
        [ARTIST_ROW_SOURCES_PREFERENCE_KEY]: { albums: "library" },
      });
      const providerArtist = artist({
        provider: "spotify--abc",
        artist_type: ArtistType.SINGER,
      });
      expect(artistRows.effectiveSource("albums", providerArtist)).toBe(
        "spotify--abc",
      );
    });
  });
});
