import { beforeEach, describe, expect, it, vi } from "vitest";

const { storeMock, mockSetUserPreference, providersMock } = vi.hoisted(() => ({
  storeMock: {
    currentUser: null as { preferences?: Record<string, unknown> } | null,
  },
  mockSetUserPreference: vi.fn(),
  providersMock: {} as Record<string, unknown>,
}));

vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/api", () => ({ api: { providers: providersMock } }));
vi.mock("@/composables/userPreferences", () => ({
  setUserPreference: mockSetUserPreference,
}));

import {
  ALBUM_ROW_SOURCES_PREFERENCE_KEY,
  ALBUM_ROWS_PREFERENCE_KEY,
  albumRows,
  availableAlbumRowIds,
  type AlbumRowId,
} from "@/components/album/albumRows";
import {
  ProviderFeature,
  ProviderType,
  type Album,
  type ItemMapping,
} from "@/plugins/api/interfaces";
import { album } from "../../fixtures/album";
import { artist } from "../../fixtures/artist";
import { providerMapping } from "../../fixtures/providerMapping";

const ALL_ROWS: AlbumRowId[] = [
  "tracks",
  "review",
  "other_versions",
  "more_from_artist",
  "provider_mappings",
  "artwork",
];

function setPreferences(preferences: Record<string, unknown>) {
  storeMock.currentUser = { preferences };
}

// registers a loaded provider instance with the given capabilities
function addProvider(instanceId: string, features: ProviderFeature[]) {
  providersMock[instanceId] = {
    instance_id: instanceId,
    name: instanceId,
    domain: instanceId.split("--")[0],
    type: ProviderType.MUSIC,
    supported_features: features,
  };
}

// an album whose artist has been loaded in full: a library artist mapped to the
// given providers, the way the view grafts it into artists[0]
function albumByLibraryArtist(...providerInstances: string[]): Album {
  return album({
    artists: [
      artist({
        item_id: "a1",
        provider: "library",
        provider_mappings: providerInstances.map((provider_instance) =>
          providerMapping({ provider_instance }),
        ),
      }),
    ],
  });
}

// an album that came from a provider, so its artist is a provider artist
function albumByProviderArtist(providerInstance: string): Album {
  return album({ artists: [artist({ provider: providerInstance })] });
}

// an album whose artist is still the slim mapping the album shipped with
function albumBySlimArtist(): Album {
  return album({
    artists: [
      {
        item_id: "a1",
        provider: "library",
        name: "Adele",
        version: "",
        uri: "library://artist/a1",
        media_type: artist().media_type,
        available: true,
      } as ItemMapping,
    ],
  });
}

describe("albumRows", () => {
  beforeEach(() => {
    storeMock.currentUser = null;
    mockSetUserPreference.mockReset();
    for (const key of Object.keys(providersMock)) delete providersMock[key];
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
      setPreferences({
        [ALBUM_ROWS_PREFERENCE_KEY]: {
          order: ["review", "tracks"],
          hidden: ["other_versions"],
        },
      });

      const { order, hidden } = albumRows.resolve(ALL_ROWS);

      expect(order.indexOf("review")).toBeLessThan(order.indexOf("tracks"));
      expect(order).toHaveLength(ALL_ROWS.length);
      expect(hidden.has("other_versions")).toBe(true);
    });
  });

  describe("definition", () => {
    it("marks 'more from this artist' as the only row with a source picker", () => {
      expect(albumRows.definition("more_from_artist").supportsSource).toBe(
        true,
      );
      for (const row of ALL_ROWS.filter((id) => id !== "more_from_artist")) {
        expect(albumRows.definition(row).supportsSource).toBeUndefined();
      }
    });
  });

  describe("sources", () => {
    it("offers the library and the capable providers of a loaded library artist", () => {
      addProvider("spotify--abc", [ProviderFeature.ARTIST_ALBUMS]);
      addProvider("tidal--def", []);

      expect(
        albumRows.sources(
          "more_from_artist",
          albumByLibraryArtist("spotify--abc", "tidal--def"),
        ),
      ).toEqual(["library", "spotify--abc"]);
    });

    it("offers nothing until the full artist has been loaded", () => {
      expect(
        albumRows.sources("more_from_artist", albumBySlimArtist()),
      ).toEqual([]);
    });

    it("offers nothing for an album from a provider artist", () => {
      addProvider("spotify--abc", [ProviderFeature.ARTIST_ALBUMS]);
      expect(
        albumRows.sources(
          "more_from_artist",
          albumByProviderArtist("spotify--abc"),
        ),
      ).toEqual([]);
    });

    it("offers nothing for the other rows", () => {
      const item = albumByLibraryArtist("spotify--abc");
      for (const row of ALL_ROWS.filter((id) => id !== "more_from_artist")) {
        expect(albumRows.sources(row, item)).toEqual([]);
      }
    });
  });

  describe("effectiveSource", () => {
    it("defaults a loaded library artist to the library", () => {
      expect(
        albumRows.effectiveSource("more_from_artist", albumByLibraryArtist()),
      ).toBe("library");
    });

    it("keeps a provider artist on its own provider", () => {
      expect(
        albumRows.effectiveSource(
          "more_from_artist",
          albumByProviderArtist("spotify--abc"),
        ),
      ).toBe("spotify--abc");
    });

    it("uses the saved source when a mapped provider can supply it", () => {
      setPreferences({
        [ALBUM_ROW_SOURCES_PREFERENCE_KEY]: {
          more_from_artist: "spotify--abc",
        },
      });
      addProvider("spotify--abc", [ProviderFeature.ARTIST_ALBUMS]);

      expect(
        albumRows.effectiveSource(
          "more_from_artist",
          albumByLibraryArtist("spotify--abc"),
        ),
      ).toBe("spotify--abc");
    });

    it("falls back to the library when the saved provider is gone", () => {
      setPreferences({
        [ALBUM_ROW_SOURCES_PREFERENCE_KEY]: {
          more_from_artist: "spotify--gone",
        },
      });
      addProvider("spotify--abc", [ProviderFeature.ARTIST_ALBUMS]);

      expect(
        albumRows.effectiveSource(
          "more_from_artist",
          albumByLibraryArtist("spotify--abc"),
        ),
      ).toBe("library");
    });
  });

  describe("row sources", () => {
    it("reads and writes the row's source under album.rowSources", async () => {
      expect(albumRows.getSource("more_from_artist")).toBeUndefined();

      setPreferences({
        [ALBUM_ROW_SOURCES_PREFERENCE_KEY]: {
          more_from_artist: "spotify--abc",
        },
      });
      expect(albumRows.getSource("more_from_artist")).toBe("spotify--abc");

      await albumRows.setSource("more_from_artist", "library");
      expect(mockSetUserPreference).toHaveBeenLastCalledWith(
        ALBUM_ROW_SOURCES_PREFERENCE_KEY,
        { more_from_artist: "library" },
      );
    });

    it("clears both preferences on reset", async () => {
      await albumRows.reset();
      expect(mockSetUserPreference).toHaveBeenLastCalledWith(
        ALBUM_ROW_SOURCES_PREFERENCE_KEY,
        {},
      );
    });
  });
});
