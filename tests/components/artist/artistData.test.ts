import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getArtistAlbums: vi.fn().mockResolvedValue([]),
    getArtistAppearsOn: vi.fn().mockResolvedValue([]),
    getArtistTracks: vi.fn().mockResolvedValue([]),
    getArtistTopTracks: vi.fn().mockResolvedValue([]),
    getSimilarArtists: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
}));

import {
  isSingleOrEp,
  loadArtistAppearsOn,
  loadArtistLibraryTracks,
  loadArtistReleases,
  loadArtistTopTracks,
  loadSimilarArtists,
  sortReleasesNewestFirst,
} from "@/components/artist/artistData";
import { AlbumType, type ItemMapping } from "@/plugins/api/interfaces";
import { album } from "../../fixtures/album";
import { artist } from "../../fixtures/artist";
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
    apiMock.getArtistTopTracks.mockClear();
    apiMock.getSimilarArtists.mockClear();
    apiMock.getArtistTracks.mockClear();
    apiMock.getArtistAppearsOn.mockClear();
  });

  describe("loadArtistReleases", () => {
    it("asks the library for the library source", async () => {
      await loadArtistReleases(LIBRARY_ARTIST, "library");
      expect(apiMock.getArtistAlbums).toHaveBeenLastCalledWith("1", "library");
    });

    it("asks a provider source for its own catalog, by the artist's id there", async () => {
      await loadArtistReleases(LIBRARY_ARTIST, "spotify--abc");
      expect(apiMock.getArtistAlbums).toHaveBeenLastCalledWith(
        "sp1",
        "spotify--abc",
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

  describe("loadArtistLibraryTracks", () => {
    it("passes the provider filter through", async () => {
      await loadArtistLibraryTracks(LIBRARY_ARTIST, "spotify--abc");
      expect(apiMock.getArtistTracks).toHaveBeenLastCalledWith(
        "1",
        "library",
        "spotify--abc",
      );
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
