import { radioSong, radioSongLabel } from "@/helpers/radio_song";
import type { PlayerMedia } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
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
