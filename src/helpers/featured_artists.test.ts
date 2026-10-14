import type { ItemMapping } from "@/plugins/api/interfaces";
import { MediaType } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { rankFeaturedArtists } from "./featured_artists";

const artist = (name: string): ItemMapping => ({
  item_id: name,
  provider: "library",
  name,
  version: "",
  uri: `library://artist/${name}`,
  external_ids: [],
  is_playable: true,
  media_type: MediaType.ARTIST,
  available: true,
});

const tracks = (...artistsPerTrack: string[][]) =>
  artistsPerTrack.map((names) => ({ artists: names.map(artist) }));

const names = (ranked: Array<{ name: string }>) => ranked.map((a) => a.name);

describe("rankFeaturedArtists", () => {
  it("puts the artists on the most tracks first", () => {
    const ranked = rankFeaturedArtists(
      tracks(["Dezza"], ["Lane 8"], ["Lane 8", "Dezza"], ["Lane 8"]),
      10,
    );
    expect(names(ranked)).toEqual(["Lane 8", "Dezza"]);
  });

  it("keeps artists on as many tracks in the order they first appear", () => {
    const ranked = rankFeaturedArtists(
      tracks(["Grum"], ["Aiiso"], ["Cubicolor"]),
      10,
    );
    expect(names(ranked)).toEqual(["Grum", "Aiiso", "Cubicolor"]);
  });

  it("counts an artist once per track it is on", () => {
    const ranked = rankFeaturedArtists(tracks(["Wood", "Ben Böhmer"]), 10);
    expect(names(ranked)).toEqual(["Wood", "Ben Böhmer"]);
  });

  it("stops at the limit", () => {
    const ranked = rankFeaturedArtists(tracks(["A"], ["B"], ["C"]), 2);
    expect(names(ranked)).toEqual(["A", "B"]);
  });

  it("skips tracks without artists", () => {
    expect(rankFeaturedArtists([{}, { artists: [] }], 10)).toEqual([]);
  });
});
