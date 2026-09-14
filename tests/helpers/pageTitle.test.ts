import { DEFAULT_PAGE_TITLE, getPageTitle } from "@/helpers/pageTitle";
import { describe, expect, it } from "vitest";

describe("getPageTitle", () => {
  it("formats a complete track and artist pair", () => {
    expect(getPageTitle("Song Title", "Artist Name")).toBe(
      "Song Title — Artist Name",
    );
  });

  it.each([
    [undefined, undefined],
    ["Song Title", undefined],
    [undefined, "Artist Name"],
    ["", "Artist Name"],
    ["Song Title", ""],
    ["   ", "Artist Name"],
    ["Song Title", "   "],
  ])("uses the branded fallback for incomplete metadata", (title, artist) => {
    expect(getPageTitle(title, artist)).toBe(DEFAULT_PAGE_TITLE);
  });

  it("trims metadata before formatting", () => {
    expect(getPageTitle("  Song Title  ", "  Artist Name  ")).toBe(
      "Song Title — Artist Name",
    );
  });

  it("reflects updated metadata", () => {
    expect(getPageTitle("First Song", "First Artist")).toBe(
      "First Song — First Artist",
    );
    expect(getPageTitle("Second Song", "Second Artist")).toBe(
      "Second Song — Second Artist",
    );
  });
});
