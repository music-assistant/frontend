import ArtistIcon from "@/components/icons/ArtistIcon.vue";
import GenreIcon from "@/components/icons/GenreIcon.vue";
import { MediaType } from "@/plugins/api/interfaces";
import {
  BookAudio,
  Disc3,
  Folder,
  ListMusic,
  Music2,
  Podcast,
  Radio,
} from "@lucide/vue";
import { describe, expect, it } from "vitest";
import { getMediaTypeIcon } from "./media_type_icon";

describe("getMediaTypeIcon", () => {
  it.each([
    [MediaType.ARTIST, ArtistIcon],
    [MediaType.ALBUM, Disc3],
    [MediaType.TRACK, Music2],
    [MediaType.PLAYLIST, ListMusic],
    [MediaType.AUDIOBOOK, BookAudio],
    [MediaType.PODCAST, Podcast],
    [MediaType.RADIO, Radio],
    [MediaType.GENRE, GenreIcon],
    [MediaType.FOLDER, Folder],
  ])("gives %s the icon of its menu entry", (mediaType, icon) => {
    expect(getMediaTypeIcon(mediaType)).toBe(icon);
  });

  it("gives a podcast episode the podcast icon", () => {
    expect(getMediaTypeIcon(MediaType.PODCAST_EPISODE)).toBe(Podcast);
  });

  it("has no icon for a type without a menu entry", () => {
    expect(getMediaTypeIcon(MediaType.UNKNOWN)).toBeUndefined();
  });

  it("has no icon without a type", () => {
    expect(getMediaTypeIcon(undefined)).toBeUndefined();
  });
});
