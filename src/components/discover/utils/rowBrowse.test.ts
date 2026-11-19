import { describe, expect, it } from "vitest";

import { rowBrowsePath, rowBrowseRoute } from "./rowBrowse";

describe("rowBrowsePath", () => {
  it("addresses a row by its provider and item id", () => {
    expect(
      rowBrowsePath({
        provider: "recommendations",
        item_id: "recently_added_albums",
      }),
    ).toBe("discover://recommendations/recently_added_albums");
  });

  it("keeps slashes in the item id", () => {
    expect(
      rowBrowsePath({ provider: "ytmusic--abc", item_id: "mixes/for you" }),
    ).toBe("discover://ytmusic--abc/mixes/for you");
  });
});

describe("rowBrowseRoute", () => {
  it("opens the row on the Browse page", () => {
    expect(
      rowBrowseRoute({ provider: "deezer--xyz", item_id: "made_for_you" }),
    ).toEqual({
      name: "browse",
      query: { path: "discover://deezer--xyz/made_for_you" },
    });
  });
});
