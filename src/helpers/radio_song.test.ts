import {
  matchesRadioSong,
  radioSong,
  radioSongLabel,
} from "@/helpers/radio_song";
import type { PlayerMedia } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { artist } from "../../tests/fixtures/artist";
import { radio } from "../../tests/fixtures/radio";
import { track } from "../../tests/fixtures/track";

function media(overrides: Partial<PlayerMedia>): PlayerMedia {
  return { artist: null, title: null, ...overrides } as PlayerMedia;
}

describe("radioSong", () => {
  it("is the song a station names", () => {
    expect(
      radioSong(radio(), media({ artist: "Artist", title: "Title" })),
    ).toEqual({ artist: "Artist", title: "Title" });
  });

  it.each([
    { name: "no artist", current: media({ title: "Title" }) },
    { name: "no title", current: media({ artist: "Artist" }) },
    { name: "nothing reported", current: null },
  ])("is unknown for a station with $name", ({ current }) => {
    expect(radioSong(radio(), current)).toBeUndefined();
  });

  it("is unknown for anything but a station", () => {
    expect(
      radioSong(track(), media({ artist: "Artist", title: "Title" })),
    ).toBeUndefined();
  });
});

describe("radioSongLabel", () => {
  it("puts the artist first", () => {
    expect(radioSongLabel({ artist: "Artist", title: "Title" })).toBe(
      "Artist – Title",
    );
  });
});

describe("matchesRadioSong", () => {
  const song = { artist: "The Artist", title: "The Title" };

  it("matches the title and one of the artists, ignoring case", () => {
    const candidate = track({
      name: "the title",
      artists: [artist({ name: "Other" }), artist({ name: "THE ARTIST" })],
    });

    expect(matchesRadioSong(candidate, song)).toBe(true);
  });

  it.each([
    { name: "another title", artistName: "The Artist", title: "Title" },
    { name: "another artist", artistName: "Other", title: "The Title" },
  ])("does not match $name", ({ artistName, title }) => {
    const candidate = track({
      name: title,
      artists: [artist({ name: artistName })],
    });

    expect(matchesRadioSong(candidate, song)).toBe(false);
  });
});
