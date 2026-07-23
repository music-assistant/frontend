import {
  isMusicQuizSourceItem,
  MUSIC_QUIZ_DEFAULT_SOURCE_MEDIA_TYPES,
  MUSIC_QUIZ_SOURCE_MEDIA_TYPES,
  useMusicQuizSources,
} from "@/composables/music-quiz/useMusicQuizSources";
import { MediaType } from "@/plugins/api/interfaces";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, args?: unknown[]) =>
    args ? `${key}:${args.join(",")}` : key,
}));

function itemOf(mediaType: MediaType, uri: string) {
  return { uri, name: uri, media_type: mediaType } as never;
}

describe("MUSIC_QUIZ_SOURCE_MEDIA_TYPES", () => {
  it("allows exactly track, playlist, genre, album and artist", () => {
    expect(MUSIC_QUIZ_SOURCE_MEDIA_TYPES).toEqual([
      MediaType.TRACK,
      MediaType.PLAYLIST,
      MediaType.GENRE,
      MediaType.ALBUM,
      MediaType.ARTIST,
    ]);
  });

  it("excludes unsupported media types", () => {
    expect(MUSIC_QUIZ_SOURCE_MEDIA_TYPES).not.toEqual(
      expect.arrayContaining([
        MediaType.RADIO,
        MediaType.PODCAST,
        MediaType.PODCAST_EPISODE,
        MediaType.AUDIOBOOK,
      ]),
    );
  });

  it("defaults the selection to playlists and genres", () => {
    expect(MUSIC_QUIZ_DEFAULT_SOURCE_MEDIA_TYPES).toEqual([
      MediaType.PLAYLIST,
      MediaType.GENRE,
    ]);
  });
});

describe("isMusicQuizSourceItem", () => {
  it.each(MUSIC_QUIZ_SOURCE_MEDIA_TYPES)("accepts a %s item", (mediaType) => {
    expect(isMusicQuizSourceItem(itemOf(mediaType, `${mediaType}:1`))).toBe(
      true,
    );
  });

  it.each([
    MediaType.RADIO,
    MediaType.PODCAST,
    MediaType.PODCAST_EPISODE,
    MediaType.AUDIOBOOK,
  ])("rejects an unsupported %s item", (mediaType) => {
    expect(isMusicQuizSourceItem(itemOf(mediaType, `${mediaType}:1`))).toBe(
      false,
    );
  });
});

describe("useMusicQuizSources", () => {
  it("starts empty and cannot create a quiz", () => {
    const { selected, sourceUris, canCreate } = useMusicQuizSources();
    expect(selected.value).toEqual([]);
    expect(sourceUris.value).toEqual([]);
    expect(canCreate.value).toBe(false);
  });

  it("adds each allowed source type and exposes their URIs", () => {
    const { add, sourceUris, canCreate } = useMusicQuizSources();
    for (const mediaType of MUSIC_QUIZ_SOURCE_MEDIA_TYPES) {
      add(itemOf(mediaType, `${mediaType}:1`));
    }
    expect(sourceUris.value).toEqual(
      MUSIC_QUIZ_SOURCE_MEDIA_TYPES.map((mediaType) => `${mediaType}:1`),
    );
    expect(canCreate.value).toBe(true);
  });

  it("ignores a duplicate uri", () => {
    const { add, selected } = useMusicQuizSources();
    add(itemOf(MediaType.PLAYLIST, "playlist:1"));
    add(itemOf(MediaType.PLAYLIST, "playlist:1"));
    expect(selected.value).toHaveLength(1);
  });

  it("removes a source by uri", () => {
    const { add, remove, selected } = useMusicQuizSources();
    add(itemOf(MediaType.TRACK, "track:1"));
    add(itemOf(MediaType.PLAYLIST, "playlist:1"));
    remove("track:1");
    expect(selected.value.map((item) => item.uri)).toEqual(["playlist:1"]);
  });
});
