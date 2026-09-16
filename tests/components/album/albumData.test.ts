import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    serverInfo: { value: null },
    getAlbumTracks: vi.fn().mockResolvedValue([]),
    getAlbumVersions: vi.fn().mockResolvedValue([]),
    getArtistAlbums: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock }));

import {
  albumBackdrop,
  albumDuration,
  albumReview,
  loadAlbumTracks,
  loadAlbumVersions,
  loadArtistReleases,
} from "@/components/album/albumData";
import { ImageType, type ItemMapping } from "@/plugins/api/interfaces";
import { album } from "../../fixtures/album";
import { artist } from "../../fixtures/artist";
import { track } from "../../fixtures/track";

const ALBUM = album({ item_id: "1", provider: "library", name: "21" });

function artistMapping(): ItemMapping {
  return {
    item_id: "a1",
    provider: "library",
    name: "Adele",
    version: "",
    uri: "library://artist/a1",
    media_type: artist().media_type,
    available: true,
  } as ItemMapping;
}

function image(type: ImageType, path: string) {
  return { type, path, provider: "builtin", remotely_accessible: true };
}

describe("albumData", () => {
  beforeEach(() => {
    apiMock.getAlbumTracks.mockClear();
    apiMock.getAlbumVersions.mockClear();
    apiMock.getArtistAlbums.mockClear();
    apiMock.getArtistAlbums.mockResolvedValue([]);
  });

  describe("loadAlbumTracks", () => {
    it("asks for the whole album, or only the library's half of it", async () => {
      await loadAlbumTracks(ALBUM);
      expect(apiMock.getAlbumTracks).toHaveBeenLastCalledWith(
        "1",
        "library",
        false,
      );

      await loadAlbumTracks(ALBUM, true);
      expect(apiMock.getAlbumTracks).toHaveBeenLastCalledWith(
        "1",
        "library",
        true,
      );
    });
  });

  describe("loadAlbumVersions", () => {
    it("asks for the versions of the album on screen", async () => {
      await loadAlbumVersions(ALBUM);
      expect(apiMock.getAlbumVersions).toHaveBeenLastCalledWith("1", "library");
    });
  });

  describe("loadArtistReleases", () => {
    it("lists the album artist's releases, newest first", async () => {
      apiMock.getArtistAlbums.mockResolvedValue([
        album({ item_id: "2", name: "19", year: 2008 }),
        album({ item_id: "3", name: "30", year: 2021 }),
      ]);

      const releases = await loadArtistReleases(
        album({ ...ALBUM, artists: [artistMapping()] }),
      );

      expect(apiMock.getArtistAlbums).toHaveBeenCalledWith("a1", "library");
      expect(releases.map((release) => release.name)).toEqual(["30", "19"]);
    });

    // the artist's releases come from whichever provider holds the artist, so
    // the album on screen can come back under an id this page never saw
    it("leaves out the album itself, by id and by name", async () => {
      apiMock.getArtistAlbums.mockResolvedValue([
        album({ item_id: "1", name: "21" }),
        album({ item_id: "9", provider: "spotify--1", name: "21" }),
        album({ item_id: "2", name: "19" }),
      ]);

      const releases = await loadArtistReleases(
        album({ ...ALBUM, artists: [artistMapping()] }),
      );

      expect(releases.map((release) => release.name)).toEqual(["19"]);
    });

    it("has nothing to show for an album without an artist", async () => {
      expect(await loadArtistReleases(ALBUM)).toEqual([]);
      expect(apiMock.getArtistAlbums).not.toHaveBeenCalled();
    });
  });

  describe("albumReview", () => {
    it("prefers the review over the description", () => {
      expect(
        albumReview(
          album({ metadata: { review: "A review", description: "A blurb" } }),
        ),
      ).toBe("A review");
      expect(albumReview(album({ metadata: { description: "A blurb" } }))).toBe(
        "A blurb",
      );
      expect(albumReview(album())).toBeUndefined();
    });
  });

  describe("albumDuration", () => {
    it("adds up what the tracks last", () => {
      expect(
        albumDuration([
          track({ item_id: "1", duration: 100 }),
          track({ item_id: "2", duration: 42 }),
        ]),
      ).toBe(142);
      expect(albumDuration([])).toBe(0);
    });
  });

  describe("albumBackdrop", () => {
    it("paints wide art of the album as it is", () => {
      const withFanart = album({
        metadata: { images: [image(ImageType.FANART, "wide.jpg")] },
      });

      const backdrop = albumBackdrop(withFanart);

      expect(backdrop.url).toContain("wide.jpg");
      expect(backdrop.blurred).toBe(false);
    });

    it("falls back to the artist's wide art", () => {
      const withFanart = artist({
        metadata: { images: [image(ImageType.FANART, "artist.jpg")] },
      });

      const backdrop = albumBackdrop(ALBUM, withFanart);

      expect(backdrop.url).toContain("artist.jpg");
      expect(backdrop.blurred).toBe(false);
    });

    // a cover beside itself reads as a mistake, so it stands in blurred
    it("blurs the cover when nothing wide is to be had", () => {
      const withCover = album({
        metadata: { images: [image(ImageType.THUMB, "cover.jpg")] },
      });

      const backdrop = albumBackdrop(withCover);

      expect(backdrop.url).toContain("cover.jpg");
      expect(backdrop.blurred).toBe(true);
    });
  });
});
