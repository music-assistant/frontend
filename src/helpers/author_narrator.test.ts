import { describe, expect, it } from "vitest";
import { isAuthorOrNarrator } from "./author_narrator";
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
    ? { media_type }
    : { media_type, artist_type }) as MediaItemTypeOrItemMapping;

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
