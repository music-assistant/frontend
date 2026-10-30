import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getArtistAlbums: vi.fn().mockResolvedValue([]),
    getArtistAlbumsCount: vi.fn().mockResolvedValue(0),
    getArtistAppearsOn: vi.fn().mockResolvedValue([]),
    getArtistDiscography: vi.fn().mockResolvedValue([]),
    getArtistTracks: vi.fn().mockResolvedValue([]),
    getArtistTopTracks: vi.fn().mockResolvedValue([]),
    getSimilarArtists: vi.fn().mockResolvedValue([]),
    providers: {} as Record<string, ProviderInstance>,
    providerManifests: {} as Record<string, ProviderManifest>,
  },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

import {
  artistAlbumsBySource,
  artistAlbumsCountBySource,
  artistProvidersForFeature,
  isSingleOrEp,
  loadArtistAppearsOn,
  loadArtistDiscography,
  loadArtistReleases,
  loadArtistTopTracks,
  loadArtistTracks,
  loadSimilarArtists,
  sortReleasesNewestFirst,
} from "@/components/artist/artistData";
import {
  AlbumType,
  ProviderFeature,
  type ItemMapping,
  type ProviderInstance,
  type ProviderManifest,
} from "@/plugins/api/interfaces";
import { album } from "../../fixtures/album";
import { artist } from "../../fixtures/artist";
import { providerInstance } from "../../fixtures/providerInstance";
import { providerManifest } from "../../fixtures/providerManifest";
import { providerMapping } from "../../fixtures/providerMapping";

// the artist's own id on Spotify differs from its library id, so the provider
// source can only be queried through the mapping
const LIBRARY_ARTIST = artist({
  item_id: "1",
  provider: "library",
  provider_mappings: [
    providerMapping({ item_id: "sp1", provider_instance: "spotify--abc" }),
  ],
});
const PROVIDER_ARTIST = artist({ item_id: "sp1", provider: "spotify--abc" });

function albumMapping(overrides: Partial<ItemMapping> = {}): ItemMapping {
  return {
    item_id: "10",
    provider: "library",
    name: "Compilation",
    version: "",
    uri: "library://album/10",
    external_ids: [],
    is_playable: true,
    media_type: album().media_type,
    available: true,
    ...overrides,
  };
}

describe("artistData", () => {
  beforeEach(() => {
    apiMock.getArtistAlbums.mockClear();
    apiMock.getArtistAlbumsCount.mockClear();
    apiMock.getArtistTopTracks.mockClear();
    apiMock.getSimilarArtists.mockClear();
    apiMock.getArtistTracks.mockClear();
    apiMock.getArtistAppearsOn.mockClear();
  });

  describe("loadArtistReleases", () => {
    it.each([true, false, undefined])(
      "maps the album favorite-only toggle %s to the server filter",
      async (favoritesOnly) => {
        await artistAlbumsBySource(LIBRARY_ARTIST, "library", {
          limit: 20,
          favoritesOnly,
        });

        expect(apiMock.getArtistAlbums).toHaveBeenLastCalledWith(
          "1",
          "library",
          undefined,
          undefined,
          20,
          undefined,
          undefined,
          undefined,
          undefined,
          favoritesOnly || undefined,
        );
      },
    );

    it("asks the library for the library source", async () => {
      await loadArtistReleases(LIBRARY_ARTIST, "library");
      expect(apiMock.getArtistAlbums).toHaveBeenLastCalledWith(
        "1",
        "library",
        undefined,
        undefined,
        0,
      );
    });

    it("asks a provider source for its own catalog, by the artist's id there", async () => {
      await loadArtistReleases(LIBRARY_ARTIST, "spotify--abc");
      expect(apiMock.getArtistAlbums).toHaveBeenLastCalledWith(
        "sp1",
        "spotify--abc",
        undefined,
        undefined,
        0,
      );
    });

    it("returns nothing for a provider the artist is not mapped to", async () => {
      expect(await loadArtistReleases(LIBRARY_ARTIST, "tidal--def")).toEqual(
        [],
      );
      expect(apiMock.getArtistAlbums).not.toHaveBeenCalled();
    });

    it("asks a provider artist's own provider", async () => {
      await loadArtistReleases(PROVIDER_ARTIST, "spotify--abc");
      expect(apiMock.getArtistAlbums).toHaveBeenLastCalledWith(
        "sp1",
        "spotify--abc",
        undefined,
        undefined,
        0,
      );
    });
  });

  describe("artistAlbumsCountBySource", () => {
    it("uses the matching provider artist id and album type filter", async () => {
      await artistAlbumsCountBySource(LIBRARY_ARTIST, "spotify--abc", [
        AlbumType.SINGLE,
      ]);

      expect(apiMock.getArtistAlbumsCount).toHaveBeenCalledWith(
        "sp1",
        "spotify--abc",
        undefined,
        undefined,
        [AlbumType.SINGLE],
      );
    });

    it("does not request a count from an unmapped provider", async () => {
      expect(
        await artistAlbumsCountBySource(LIBRARY_ARTIST, "tidal--def", [
          AlbumType.ALBUM,
        ]),
      ).toBe(0);
      expect(apiMock.getArtistAlbumsCount).not.toHaveBeenCalled();
    });
  });

  describe("loadArtistDiscography", () => {
    it("asks for the whole discography unless a page is asked for", async () => {
      await loadArtistDiscography(LIBRARY_ARTIST);
      expect(apiMock.getArtistDiscography).toHaveBeenLastCalledWith(
        "1",
        undefined,
        0,
        undefined,
        undefined,
        undefined,
      );

      await loadArtistDiscography(LIBRARY_ARTIST, "live", 20, 40);
      expect(apiMock.getArtistDiscography).toHaveBeenLastCalledWith(
        "1",
        "live",
        20,
        40,
        undefined,
        undefined,
      );
    });
  });

  describe("loadArtistAppearsOn", () => {
    it("asks the server for a library artist's appearances", async () => {
      const appearances = [album({ item_id: "guest" })];
      apiMock.getArtistAppearsOn.mockResolvedValueOnce(appearances);

      expect(await loadArtistAppearsOn(LIBRARY_ARTIST)).toEqual(appearances);
      expect(apiMock.getArtistAppearsOn).toHaveBeenLastCalledWith(
        "1",
        "library",
        undefined,
        undefined,
        0,
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe("loadArtistTopTracks / loadSimilarArtists", () => {
    it("passes a provider source as the filter for a library artist", async () => {
      await loadArtistTopTracks(LIBRARY_ARTIST, "spotify--abc");
      expect(apiMock.getArtistTopTracks).toHaveBeenLastCalledWith(
        "1",
        "library",
        "spotify--abc",
      );

      await loadSimilarArtists(LIBRARY_ARTIST, "all");
      expect(apiMock.getSimilarArtists).toHaveBeenLastCalledWith(
        "1",
        "library",
        25,
        undefined,
      );
    });

    it("never filters a provider artist", async () => {
      await loadArtistTopTracks(PROVIDER_ARTIST, "spotify--abc");
      expect(apiMock.getArtistTopTracks).toHaveBeenLastCalledWith(
        "sp1",
        "spotify--abc",
        undefined,
      );
    });
  });

  describe("loadArtistTracks", () => {
    it.each([true, false])(
      "maps the track favorite-only toggle %s to the server filter",
      async (favoriteOnly) => {
        await loadArtistTracks(
          LIBRARY_ARTIST,
          undefined,
          undefined,
          20,
          undefined,
          undefined,
          undefined,
          favoriteOnly,
        );

        expect(apiMock.getArtistTracks).toHaveBeenLastCalledWith(
          "1",
          "library",
          undefined,
          undefined,
          20,
          undefined,
          undefined,
          undefined,
          favoriteOnly || undefined,
        );
      },
    );

    it("requests all tracks when no page parameters are given", async () => {
      await loadArtistTracks(LIBRARY_ARTIST);
      expect(apiMock.getArtistTracks).toHaveBeenLastCalledWith(
        "1",
        "library",
        undefined,
        undefined,
        0,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    it("passes the provider filter through", async () => {
      await loadArtistTracks(LIBRARY_ARTIST, "spotify--abc");
      expect(apiMock.getArtistTracks).toHaveBeenLastCalledWith(
        "1",
        "library",
        "spotify--abc",
        undefined,
        0,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe("artistProvidersForFeature", () => {
    // registers a loaded provider instance that lists artist albums
    function addProvider(overrides: Partial<ProviderInstance>) {
      const provider = providerInstance({
        supported_features: [ProviderFeature.ARTIST_ALBUMS],
        ...overrides,
      });
      apiMock.providers[provider.instance_id] = provider;
    }

    function mappedTo(...providerInstances: string[]) {
      return artist({
        provider_mappings: providerInstances.map((provider_instance) =>
          providerMapping({ provider_instance }),
        ),
      });
    }

    beforeEach(() => {
      apiMock.providers = {};
      apiMock.providerManifests = {
        spotify: providerManifest({ domain: "spotify", name: "Spotify" }),
      };
    });

    it("offers each account of a streaming service once, as its lowest instance id", () => {
      for (const [instanceId, name] of [
        ["spotify--b", "Spotify [marcelveldt3]"],
        ["spotify--a", "Spotify [marcelveldt2]"],
      ]) {
        addProvider({
          instance_id: instanceId,
          name,
          domain: "spotify",
          is_streaming_provider: true,
        });
      }

      expect(
        artistProvidersForFeature(
          mappedTo("spotify--b", "spotify--a"),
          ProviderFeature.ARTIST_ALBUMS,
        ),
      ).toEqual(["spotify--a"]);
    });

    it("keeps every other instance, sorted by the name each source shows", () => {
      addProvider({
        instance_id: "spotify--a",
        name: "Zoe's Spotify",
        domain: "spotify",
        is_streaming_provider: true,
      });
      addProvider({
        instance_id: "filesystem_local--x",
        name: "Vinyl rips",
        domain: "filesystem_local",
      });
      addProvider({
        instance_id: "filesystem_local--y",
        name: "Archive",
        domain: "filesystem_local",
      });

      expect(
        artistProvidersForFeature(
          mappedTo("spotify--a", "filesystem_local--x", "filesystem_local--y"),
          ProviderFeature.ARTIST_ALBUMS,
        ),
      ).toEqual(["filesystem_local--y", "spotify--a", "filesystem_local--x"]);
    });

    it("leaves out a provider without the feature", () => {
      addProvider({ instance_id: "tidal--a", supported_features: [] });

      expect(
        artistProvidersForFeature(
          mappedTo("tidal--a"),
          ProviderFeature.ARTIST_ALBUMS,
        ),
      ).toEqual([]);
    });
  });

  describe("isSingleOrEp", () => {
    it("recognizes singles and EPs", () => {
      expect(isSingleOrEp(album({ album_type: AlbumType.SINGLE }))).toBe(true);
      expect(isSingleOrEp(album({ album_type: AlbumType.EP }))).toBe(true);
      expect(isSingleOrEp(album({ album_type: AlbumType.ALBUM }))).toBe(false);
      expect(isSingleOrEp(albumMapping())).toBe(false);
    });
  });

  describe("sortReleasesNewestFirst", () => {
    it("sorts by release date, then year, then name", () => {
      const dated = album({
        item_id: "a",
        name: "Dated",
        year: 1990,
        metadata: { release_date: "2020-06-01" },
      });
      const newer = album({ item_id: "b", name: "Newer", year: 2021 });
      const older = album({ item_id: "c", name: "Older", year: 2019 });
      const undated = album({ item_id: "d", name: "Undated" });

      expect(
        sortReleasesNewestFirst([undated, older, dated, newer]).map(
          (release) => release.name,
        ),
      ).toEqual(["Newer", "Dated", "Older", "Undated"]);
    });

    it("leaves the given array untouched", () => {
      const releases = [album({ year: 2000 }), album({ year: 2010 })];
      sortReleasesNewestFirst(releases);
      expect(releases[0].year).toBe(2000);
    });
  });
});
