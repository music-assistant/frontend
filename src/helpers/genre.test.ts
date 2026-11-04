import { describe, expect, it } from "vitest";
import { BookAudio, Music, Podcast } from "@lucide/vue";
import {
  genreContentTypeIcon,
  genreMediaTypeIconMap,
  mappedAliases,
  rankedAliases,
} from "./genre";
import { Genre, MediaType } from "../plugins/api/interfaces";

const genre = (name: string, aliases: string[] | null): Genre =>
  ({ name, genre_aliases: aliases }) as Genre;

describe("genre icons", () => {
  it.each([
    [MediaType.AUDIOBOOK, BookAudio],
    [MediaType.PODCAST, Podcast],
    [null, Music],
    [undefined, Music],
    [MediaType.TRACK, Music],
  ])("returns a component for taxonomy %s", (contentType, icon) => {
    expect(genreContentTypeIcon(contentType)).toBe(icon);
  });

  it("provides a component rather than an mdi string for every media type", () => {
    for (const mediaType of Object.values(MediaType)) {
      expect(genreMediaTypeIconMap[mediaType]).toBeDefined();
      expect(typeof genreMediaTypeIconMap[mediaType]).not.toBe("string");
    }
  });
});

describe("mappedAliases", () => {
  it("excludes the genre's own name, case-insensitively", () => {
    expect(mappedAliases(genre("Rock", ["rock", "Classic Rock"]))).toEqual([
      "Classic Rock",
    ]);
  });

  it("returns an empty list when genre_aliases is missing", () => {
    expect(mappedAliases(genre("Rock", null))).toEqual([]);
  });

  it("keeps aliases that merely contain the name", () => {
    expect(mappedAliases(genre("Rock", ["Rock", "Rockabilly"]))).toEqual([
      "Rockabilly",
    ]);
  });
});

describe("rankedAliases", () => {
  it("lists exact, then leading, then contained matches, then the rest", () => {
    expect(
      rankedAliases(
        [
          genre("Hip Hop", [
            "Acid Jazz",
            "Abstract Hip Hop",
            "Hip-Hop",
            "Hip Hop Soul",
          ]),
        ],
        "hip hop",
      ),
    ).toEqual(["Hip-Hop", "Hip Hop Soul", "Abstract Hip Hop", "Acid Jazz"]);
  });

  it("keeps only the matching aliases of a genre whose name does not match", () => {
    expect(
      rankedAliases(
        [genre("R&B", ["Blue-Eyed Soul", "Hip Hop Soul"])],
        "hip hop",
      ),
    ).toEqual(["Hip Hop Soul"]);
  });

  it("offers every alias when the server matched a localized name", () => {
    expect(
      rankedAliases([genre("Classical", ["Opera", "Baroque"])], "Klassik"),
    ).toEqual(["Baroque", "Opera"]);
  });

  it("ignores accents and lists an alias shared by two genres once", () => {
    expect(
      rankedAliases(
        [genre("Raï", ["Raï"]), genre("World", ["Rai", "Raï"])],
        "rai",
      ),
    ).toEqual(["Rai", "Raï"]);
  });
});
