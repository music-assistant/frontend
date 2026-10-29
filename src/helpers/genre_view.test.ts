import { describe, expect, it } from "vitest";
import { applyGenreView, GENRE_SECTION_ITEMTYPES } from "./genre_view";

describe("applyGenreView", () => {
  it("saves the view", () => {
    expect(
      applyGenreView({ genre_detail_view: "panel", a: 1 }, "list"),
    ).toEqual({ genre_detail_view: "list", a: 1 });
  });

  it("hides every section's actions when leaving a compact view", () => {
    const saved = applyGenreView(
      { genre_detail_view: "panel_compact" },
      "list",
    );

    expect(saved.genre_detail_view).toBe("list");
    for (const itemtype of GENRE_SECTION_ITEMTYPES) {
      expect(saved[`itemsListing.${itemtype}.${itemtype}`]).toEqual({
        showActions: false,
      });
    }
  });

  it("keeps a section's own settings", () => {
    const saved = applyGenreView(
      {
        genre_detail_view: "panel_compact",
        "itemsListing.albums.albums": { gridSize: -1, showActions: true },
      },
      "panel",
    );

    expect(saved["itemsListing.albums.albums"]).toEqual({
      gridSize: -1,
      showActions: true,
    });
  });
});
