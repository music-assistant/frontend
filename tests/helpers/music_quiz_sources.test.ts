import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, args?: unknown[]) =>
    args ? `${key}:${args.join(",")}` : key,
}));

import {
  getMusicQuizSourceSummary,
  musicQuizSourceTypeLabel,
} from "@/helpers/music_quiz_sources";
import { MediaType } from "@/plugins/api/interfaces";

describe("getMusicQuizSourceSummary", () => {
  it("reports zero tracks for an empty selection", () => {
    expect(getMusicQuizSourceSummary([])).toBe(
      "providers.music_quiz.tracks_count:0",
    );
  });

  it("counts each allowed media type in a fixed display order", () => {
    const summary = getMusicQuizSourceSummary([
      { media_type: MediaType.ARTIST },
      { media_type: MediaType.ALBUM },
      { media_type: MediaType.GENRE },
      { media_type: MediaType.PLAYLIST },
      { media_type: MediaType.TRACK },
      { media_type: MediaType.TRACK },
    ]);
    expect(summary).toBe(
      [
        "providers.music_quiz.tracks_count:2",
        "providers.music_quiz.playlist_count:1",
        "providers.music_quiz.genre_count:1",
        "providers.music_quiz.album_count:1",
        "providers.music_quiz.artist_count:1",
      ].join(", "),
    );
  });

  it("uses the singular key for a count of one", () => {
    expect(
      getMusicQuizSourceSummary([{ media_type: MediaType.PLAYLIST }]),
    ).toBe("providers.music_quiz.playlist_count:1");
  });

  it("treats an unrecognized media type as a track", () => {
    expect(getMusicQuizSourceSummary([{ media_type: MediaType.RADIO }])).toBe(
      "providers.music_quiz.track_count:1",
    );
  });
});

describe("musicQuizSourceTypeLabel", () => {
  it.each([
    [MediaType.TRACK, "providers.music_quiz.track"],
    [MediaType.PLAYLIST, "providers.music_quiz.playlist"],
    [MediaType.GENRE, "providers.music_quiz.genre"],
    [MediaType.ALBUM, "providers.music_quiz.album"],
    [MediaType.ARTIST, "providers.music_quiz.artist"],
  ])("labels %s sources", (mediaType, expected) => {
    expect(musicQuizSourceTypeLabel(mediaType)).toBe(expected);
  });

  it("falls back to a generic label for an unsupported media type", () => {
    expect(musicQuizSourceTypeLabel(MediaType.RADIO)).toBe(
      "providers.music_quiz.source_music",
    );
  });

  it("falls back to a generic label when no media type is given", () => {
    expect(musicQuizSourceTypeLabel(undefined)).toBe(
      "providers.music_quiz.source_music",
    );
  });
});
