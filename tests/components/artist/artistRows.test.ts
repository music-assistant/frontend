import { beforeEach, describe, expect, it, vi } from "vitest";

const { storeMock, mockSetUserPreference, providersMock } = vi.hoisted(() => ({
  storeMock: {
    currentUser: null as {
      preferences?: Record<string, unknown>;
      provider_filter?: string[];
    } | null,
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
  artistRowDefinition,
  artistRowSources,
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

function setPreferences(
  preferences: Record<string, unknown>,
  providerFilter: string[] = [],
) {
  storeMock.currentUser = { preferences, provider_filter: providerFilter };
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

  describe("artistRowSources", () => {
    it("lists the library, every provider and the capable providers for a release row", () => {
      addProvider("spotify--abc", [ProviderFeature.ARTIST_ALBUMS]);
      addProvider("tidal--def", []);
      const libraryArtist = mappedTo("spotify--abc", "tidal--def");
      expect(artistRowSources("albums", libraryArtist, true)).toEqual([
        "library",
        "all",
        "spotify--abc",
      ]);
      expect(artistRowSources("albums", libraryArtist, false)).toEqual([
        "library",
        "spotify--abc",
      ]);
    });

    it("adds capable metadata providers to the aggregated rows, without the library", () => {
      addProvider("spotify--abc", [ProviderFeature.SIMILAR_ARTISTS]);
      addProvider(
        "lastfm--ghi",
        [ProviderFeature.SIMILAR_ARTISTS],
        ProviderType.METADATA,
      );
      expect(
        artistRowSources("similar_artists", mappedTo("spotify--abc"), false),
      ).toEqual(["all", "lastfm--ghi", "spotify--abc"]);
    });

    it("leaves out providers hidden by the user's provider filter", () => {
      setPreferences({}, ["spotify--abc"]);
      addProvider("spotify--abc", [ProviderFeature.ARTIST_TOPTRACKS]);
      addProvider("tidal--def", [ProviderFeature.ARTIST_TOPTRACKS]);
      expect(
        artistRowSources(
          "top_tracks",
          mappedTo("spotify--abc", "tidal--def"),
          true,
        ),
      ).toEqual(["spotify--abc"]);
    });

    it("never offers every provider while the user's own provider filter is active", () => {
      setPreferences({}, ["spotify--abc"]);
      addProvider("spotify--abc", [ProviderFeature.ARTIST_ALBUMS]);
      expect(
        artistRowSources("albums", mappedTo("spotify--abc"), true),
      ).toEqual(["library", "spotify--abc"]);
    });

    it("offers nothing for a provider artist or a row without a picker", () => {
      addProvider("spotify--abc", [ProviderFeature.ARTIST_ALBUMS]);
      const providerArtist = artist({ provider: "spotify--abc" });
      expect(artistRowSources("albums", providerArtist, true)).toEqual([]);
      expect(
        artistRowSources("appears_on", mappedTo("spotify--abc"), true),
      ).toEqual([]);
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

    it("defaults to the library or the first capable provider while a provider filter is active", () => {
      setPreferences({}, ["spotify--abc", "tidal--def"]);
      addProvider("spotify--abc", [ProviderFeature.ARTIST_TOPTRACKS]);
      addProvider("tidal--def", [ProviderFeature.ARTIST_TOPTRACKS]);
      const mapped = mappedTo("tidal--def", "spotify--abc");
      expect(effectiveArtistRowSource("albums", mapped, true)).toBe("library");
      expect(effectiveArtistRowSource("top_tracks", mapped, true)).toBe(
        "spotify--abc",
      );
    });

    it("uses the saved source when a mapped provider can supply the row", () => {
      setPreferences({
        [ARTIST_ROW_SOURCES_PREFERENCE_KEY]: { albums: "spotify--abc" },
      });
      addProvider("spotify--abc", [ProviderFeature.ARTIST_ALBUMS]);
      expect(
        effectiveArtistRowSource("albums", mappedTo("spotify--abc"), true),
      ).toBe("spotify--abc");
    });

    it("falls back to the default when the saved provider lacks the row's feature", () => {
      setPreferences({
        [ARTIST_ROW_SOURCES_PREFERENCE_KEY]: { top_tracks: "spotify--abc" },
      });
      addProvider("spotify--abc", [ProviderFeature.ARTIST_ALBUMS]);
      expect(
        effectiveArtistRowSource("top_tracks", mappedTo("spotify--abc"), true),
      ).toBe("all");
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
