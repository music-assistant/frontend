import { describe, expect, it } from "vitest";

import {
  filterAndSortItems,
  type ItemListingFilterParams,
} from "@/helpers/itemListing";
import { track } from "../../tests/fixtures/track";

const createParams = (
  overrides: Partial<ItemListingFilterParams> = {},
): ItemListingFilterParams => ({
  offset: 0,
  limit: 50,
  sortBy: "name",
  search: "",
  ...overrides,
});

describe("filterAndSortItems", () => {
  it("searches, numerically sorts, and pages without mutating its input", () => {
    const items = [
      track({ item_id: "10", name: "Track 10" }),
      track({ item_id: "2", name: "Track 2" }),
      track({ item_id: "other", name: "Other" }),
    ];

    const result = filterAndSortItems(
      items,
      createParams({ search: "track", limit: 1 }),
    );

    expect(result.map((item) => item.item_id)).toEqual(["2"]);
    expect(items.map((item) => item.item_id)).toEqual(["10", "2", "other"]);
  });

  it("filters to liked items before applying pagination", () => {
    const items = [
      track({ item_id: "liked", name: "A liked track", favorite: true }),
      track({ item_id: "disliked", name: "B disliked track", favorite: false }),
      track({ item_id: "unset", name: "C unmarked track" }),
    ];

    const result = filterAndSortItems(
      items,
      createParams({ favoritesOnly: true, limit: 1 }),
    );

    expect(result.map((item) => item.item_id)).toEqual(["liked"]);
  });
});
