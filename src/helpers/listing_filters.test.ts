import { Heart } from "@lucide/vue";
import { describe, expect, it, vi } from "vitest";
import {
  activeFilterCount,
  listingItemCount,
  type ListingChoiceFilter,
  type ListingMultiFilter,
  type ListingToggleFilter,
} from "./listing_filters";

const toggleFilter = (active: boolean): ListingToggleFilter => ({
  kind: "toggle",
  id: "favorites",
  label: "Only favorites",
  icon: Heart,
  active,
  toggle: vi.fn(),
});

const multiFilter = (selected: string[]): ListingMultiFilter => ({
  kind: "multi",
  id: "provider",
  label: "Source",
  placeholder: "Any source",
  layout: "checkboxes",
  options: [
    { label: "Spotify", value: "spotify--1" },
    { label: "Tidal", value: "tidal--1" },
  ],
  selected,
  toggle: vi.fn(),
});

const choiceFilter = (selected: string): ListingChoiceFilter => ({
  kind: "choice",
  id: "genres_shown",
  label: "Show",
  options: [
    { label: "All genres", value: "all" },
    { label: "Hide empty genres", value: "hide_empty" },
  ],
  selected,
  unfiltered: "all",
  select: vi.fn(),
});

describe("activeFilterCount", () => {
  it("counts nothing while nothing narrows the listing", () => {
    expect(
      activeFilterCount([
        toggleFilter(false),
        multiFilter([]),
        choiceFilter("all"),
      ]),
    ).toBe(0);
  });

  it("counts an active toggle, each picked value and a narrowing choice", () => {
    expect(
      activeFilterCount([
        toggleFilter(true),
        multiFilter(["spotify--1", "tidal--1"]),
        choiceFilter("hide_empty"),
      ]),
    ).toBe(4);
  });
});

describe("listingItemCount", () => {
  it("trusts the page's count while it knows every filter", () => {
    expect(
      listingItemCount({
        total: 128,
        loaded: 50,
        allLoaded: false,
        narrowedBeyondTotal: false,
      }),
    ).toBe(128);
  });

  it("counts a fully loaded listing the count does not cover", () => {
    expect(
      listingItemCount({
        total: 128,
        loaded: 23,
        allLoaded: true,
        narrowedBeyondTotal: true,
      }),
    ).toBe(23);
  });

  it("counts a fully loaded listing over the page's count, after a delete", () => {
    expect(
      listingItemCount({
        total: 3,
        loaded: 2,
        allLoaded: true,
        narrowedBeyondTotal: false,
      }),
    ).toBe(2);
  });

  it("knows no count while a narrowed listing is still loading pages", () => {
    expect(
      listingItemCount({
        total: 128,
        loaded: 50,
        allLoaded: false,
        narrowedBeyondTotal: true,
      }),
    ).toBeUndefined();
  });

  it("knows no count without a total until everything is loaded", () => {
    expect(
      listingItemCount({
        loaded: 50,
        allLoaded: false,
        narrowedBeyondTotal: false,
      }),
    ).toBeUndefined();
    expect(
      listingItemCount({
        loaded: 12,
        allLoaded: true,
        narrowedBeyondTotal: false,
      }),
    ).toBe(12);
  });
});
