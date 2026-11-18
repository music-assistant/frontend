import { describe, expect, it } from "vitest";
import { detailRoute, isAuthorOrNarrator } from "./author_narrator";
import {
  ArtistType,
  MediaType,
  type MediaItemTypeOrItemMapping,
} from "../plugins/api/interfaces";

const item = (
  media_type: MediaType,
  artist_type?: ArtistType,
): MediaItemTypeOrItemMapping =>
  (artist_type === undefined
    ? { media_type, item_id: "item_1", provider: "deezer" }
    : {
        media_type,
        artist_type,
        item_id: "item_1",
        provider: "deezer",
      }) as MediaItemTypeOrItemMapping;

describe("isAuthorOrNarrator", () => {
  it.each([
    [MediaType.ARTIST, ArtistType.AUTHOR, true],
    [MediaType.ARTIST, ArtistType.NARRATOR, true],
    [MediaType.ARTIST, ArtistType.SINGER, false],
    [MediaType.ARTIST, ArtistType.UNKNOWN, false],
    [MediaType.ARTIST, undefined, false],
    [MediaType.ALBUM, undefined, false],
  ])("%s of type %s is %s", (mediaType, artistType, expected) => {
    expect(isAuthorOrNarrator(item(mediaType, artistType))).toBe(expected);
  });
});

describe("detailRoute", () => {
  const params = { itemId: "item_1", provider: "deezer" };

  it.each([
    [
      MediaType.ARTIST,
      ArtistType.AUTHOR,
      { name: "audiobookartist", params: { ...params, role: "authors" } },
    ],
    [
      MediaType.ARTIST,
      ArtistType.NARRATOR,
      { name: "audiobookartist", params: { ...params, role: "narrators" } },
    ],
    [MediaType.ARTIST, ArtistType.SINGER, { name: "artist", params }],
    [MediaType.ARTIST, undefined, { name: "artist", params }],
    [MediaType.AUDIOBOOK, undefined, { name: "audiobook", params }],
  ])("%s of type %s opens %o", (mediaType, artistType, expected) => {
    expect(detailRoute(item(mediaType, artistType))).toEqual(expected);
  });
});
