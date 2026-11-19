import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  storeMock,
  mockSetUserPreference,
  mockSetUserPreferences,
  providersMock,
  manifestsMock,
} = vi.hoisted(() => ({
  storeMock: {
    currentUser: null as { preferences?: Record<string, unknown> } | null,
  },
  mockSetUserPreference: vi.fn(),
  mockSetUserPreferences: vi.fn(),
  providersMock: {} as Record<string, unknown>,
  manifestsMock: {} as Record<string, { name: string }>,
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("@/plugins/api", () => {
  const api = { providers: providersMock, providerManifests: manifestsMock };
  return { api, default: api };
});

vi.mock("@/composables/userPreferences", () => ({
  setUserPreference: mockSetUserPreference,
  setUserPreferences: mockSetUserPreferences,
}));

import {
  ARTIST_ROWS_PREFERENCE_KEY,
  ARTIST_ROW_SOURCES_PREFERENCE_KEY,
  artistRows,
  availableArtistRowIds,
  type ArtistRowId,
} from "@/components/artist/artistRows";
import { DISCOGRAPHY_TYPES_PREFERENCE_KEY } from "@/components/artist/discographyRows";
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
  "discography",
  "discography_second",
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
  overrides: Record<string, unknown> = {},
) {
  providersMock[instanceId] = {
    instance_id: instanceId,
    name: instanceId,
    domain: instanceId.split("--")[0],
    type,
    supported_features: features,
    ...overrides,
  };
}

describe("artistRows", () => {
  beforeEach(() => {
    mockSetUserPreference.mockReset();
    mockSetUserPreferences.mockReset();
    setPreferences({});
    for (const key of Object.keys(providersMock)) delete providersMock[key];
    for (const key of Object.keys(manifestsMock)) delete manifestsMock[key];
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
    it("lists automatic, the library and the capable providers for a release row, never every provider at once", () => {
      addProvider("spotify--abc", [ProviderFeature.ARTIST_ALBUMS]);
      addProvider("tidal--def", []);
      expect(
        artistRows.sources("albums", mappedTo("spotify--abc", "tidal--def")),
      ).toEqual(["auto", "library", "spotify--abc"]);
    });

    it("lists only the library for a release row no provider can supply", () => {
      addProvider("tidal--def", []);
      expect(artistRows.sources("albums", mappedTo("tidal--def"))).toEqual([
        "library",
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
        artistRows.sources("similar_artists", mappedTo("spotify--abc")),
      ).toEqual(["all", "lastfm--ghi", "spotify--abc"]);
    });

    it("offers a streaming service once beside the metadata providers, sorted by the name shown", () => {
      manifestsMock["spotify"] = { name: "Spotify" };
      for (const [instanceId, name] of [
        ["spotify--b", "Zoe's Spotify"],
        ["spotify--a", "Zed's Spotify"],
      ]) {
        addProvider(
          instanceId,
          [ProviderFeature.SIMILAR_ARTISTS],
          ProviderType.MUSIC,
          { name, is_streaming_provider: true },
        );
      }
      addProvider(
        "lastfm--ghi",
        [ProviderFeature.SIMILAR_ARTISTS],
        ProviderType.METADATA,
        { name: "Last.fm" },
      );
      addProvider(
        "tidal--def",
        [ProviderFeature.SIMILAR_ARTISTS],
        ProviderType.MUSIC,
        { name: "Tidal" },
      );
      expect(
        artistRows.sources(
          "similar_artists",
          mappedTo("spotify--b", "tidal--def", "spotify--a"),
        ),
      ).toEqual(["all", "lastfm--ghi", "spotify--a", "tidal--def"]);
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
        "discography",
        "discography_second",
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

    it("keeps the second discography row hidden for whoever hid the discography", () => {
      setPreferences({
        [ARTIST_ROWS_PREFERENCE_KEY]: { hidden: ["discography"] },
      });
      const { hidden } = artistRows.resolve(MUSIC_ROWS);
      expect(hidden).toEqual(new Set(["discography", "discography_second"]));
    });

    it("puts the second discography row right after a moved first one", () => {
      setPreferences({
        [ARTIST_ROWS_PREFERENCE_KEY]: {
          order: [
            "discography",
            ...MUSIC_ROWS.filter((id) => !id.startsWith("discography")),
          ],
        },
      });
      const { order } = artistRows.resolve(MUSIC_ROWS);
      expect(order.slice(0, 3)).toEqual([
        "discography",
        "discography_second",
        "bio",
      ]);
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
        "discography",
        "discography_second",
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

    it("clears the row preferences and the discography types", async () => {
      await artistRows.reset();
      expect(mockSetUserPreferences).toHaveBeenCalledOnce();
      expect(mockSetUserPreferences).toHaveBeenCalledWith({
        [ARTIST_ROWS_PREFERENCE_KEY]: { hidden: [], shown: [], order: [] },
        [ARTIST_ROW_SOURCES_PREFERENCE_KEY]: {},
        [DISCOGRAPHY_TYPES_PREFERENCE_KEY]: null,
      });
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

  // the release rows of a library artist a provider can list albums for
  describe("resolveSource of a release row", () => {
    const ROWS = ["albums", "singles_eps"] as const;

    beforeEach(() => {
      addProvider("tidal--def", [ProviderFeature.ARTIST_ALBUMS], undefined, {
        name: "Tidal",
      });
      addProvider("spotify--abc", [ProviderFeature.ARTIST_ALBUMS], undefined, {
        name: "Spotify",
      });
    });

    it.each(ROWS)("defaults %s to automatic", (rowId) => {
      expect(artistRows.effectiveSource(rowId, mappedTo("spotify--abc"))).toBe(
        "auto",
      );
    });

    it.each(ROWS)(
      "shows the library for %s when it holds releases for the row",
      (rowId) => {
        expect(
          artistRows.resolveSource(rowId, mappedTo("spotify--abc"), true),
        ).toBe("library");
      },
    );

    it.each(ROWS)(
      "turns %s to the first provider in picker order when the library holds none",
      (rowId) => {
        const mapped = mappedTo("tidal--def", "spotify--abc");
        expect(artistRows.resolveSource(rowId, mapped, false)).toBe(
          "spotify--abc",
        );
      },
    );

    it.each(ROWS)(
      "keeps %s on the library for an artist no provider can list albums for",
      (rowId) => {
        const unmapped = artist();
        expect(artistRows.effectiveSource(rowId, unmapped)).toBe("library");
        expect(artistRows.resolveSource(rowId, unmapped, false)).toBe(
          "library",
        );
        expect(artistRows.resolveSource(rowId, unmapped)).toBe("library");
      },
    );

    it.each(ROWS)("waits with %s until the library count is known", (rowId) => {
      expect(
        artistRows.resolveSource(rowId, mappedTo("spotify--abc")),
      ).toBeUndefined();
    });

    it.each(ROWS)("keeps an explicit choice for %s in every case", (rowId) => {
      const mapped = mappedTo("spotify--abc");
      setPreferences({
        [ARTIST_ROW_SOURCES_PREFERENCE_KEY]: { [rowId]: "library" },
      });
      expect(artistRows.resolveSource(rowId, mapped, false)).toBe("library");
      expect(artistRows.resolveSource(rowId, mapped)).toBe("library");

      setPreferences({
        [ARTIST_ROW_SOURCES_PREFERENCE_KEY]: { [rowId]: "spotify--abc" },
      });
      expect(artistRows.resolveSource(rowId, mapped, true)).toBe(
        "spotify--abc",
      );
      expect(artistRows.resolveSource(rowId, artist(), false)).toBe("library");
    });

    it.each(ROWS)("goes back to automatic for %s", async (rowId) => {
      setPreferences({
        [ARTIST_ROW_SOURCES_PREFERENCE_KEY]: { [rowId]: "library" },
      });
      await artistRows.setSource(rowId, "auto");
      expect(mockSetUserPreference).toHaveBeenLastCalledWith(
        ARTIST_ROW_SOURCES_PREFERENCE_KEY,
        {},
      );

      setPreferences({
        [ARTIST_ROW_SOURCES_PREFERENCE_KEY]:
          mockSetUserPreference.mock.lastCall![1],
      });
      expect(
        artistRows.resolveSource(rowId, mappedTo("spotify--abc"), false),
      ).toBe("spotify--abc");
    });
  });
});
