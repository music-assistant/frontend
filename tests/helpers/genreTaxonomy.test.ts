import { genresShareTaxonomy } from "@/helpers/genreTaxonomy";
import { MediaType } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";

describe("genresShareTaxonomy", () => {
  it("is true for an empty selection", () => {
    expect(genresShareTaxonomy([])).toBe(true);
  });

  it("is true for a single genre", () => {
    expect(genresShareTaxonomy([null])).toBe(true);
  });

  it("is true when all genres are music (null/undefined mixed)", () => {
    expect(genresShareTaxonomy([null, undefined, null])).toBe(true);
  });

  it("is true when all genres share the podcast taxonomy", () => {
    expect(genresShareTaxonomy([MediaType.PODCAST, MediaType.PODCAST])).toBe(
      true,
    );
  });

  it("is false when music and podcast genres are mixed", () => {
    expect(genresShareTaxonomy([null, MediaType.PODCAST])).toBe(false);
  });

  it("is false when podcast and audiobook genres are mixed", () => {
    expect(genresShareTaxonomy([MediaType.PODCAST, MediaType.AUDIOBOOK])).toBe(
      false,
    );
  });
});
