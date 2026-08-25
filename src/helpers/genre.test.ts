import { describe, expect, it } from "vitest";
import { mappedAliases } from "./genre";
import { Genre } from "../plugins/api/interfaces";

const genre = (name: string, aliases: string[] | null): Genre =>
  ({ name, genre_aliases: aliases }) as Genre;

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
