import { Heart } from "@lucide/vue";
import { describe, expect, it, vi } from "vitest";
import {
  activeFilterChips,
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

describe("activeFilterChips", () => {
  it("has no chips while nothing narrows the listing", () => {
    expect(
      activeFilterChips([
        toggleFilter(false),
        multiFilter([]),
        choiceFilter("all"),
      ]),
    ).toEqual([]);
  });

  it("gives an active toggle a chip that turns it off", () => {
    const filter = toggleFilter(true);
    const [chip] = activeFilterChips([filter]);

    expect(chip).toMatchObject({ label: "Only favorites", icon: Heart });
    chip.remove();
    expect(filter.toggle).toHaveBeenCalledOnce();
  });

  it("gives every picked value its own chip, named after its filter", () => {
    const filter = multiFilter(["spotify--1", "tidal--1"]);
    const chips = activeFilterChips([filter]);

    expect(chips.map((chip) => [chip.group, chip.label])).toEqual([
      ["Source", "Spotify"],
      ["Source", "Tidal"],
    ]);
    chips[1].remove();
    expect(filter.toggle).toHaveBeenCalledWith("tidal--1");
  });

  it("names a picked value that is not offered (yet) by its value", () => {
    const [chip] = activeFilterChips([multiFilter(["plex--1"])]);

    expect(chip.label).toBe("plex--1");
  });

  it("puts a narrowing choice back to the unfiltered one", () => {
    const filter = choiceFilter("hide_empty");
    const [chip] = activeFilterChips([filter]);

    expect(chip.label).toBe("Hide empty genres");
    chip.remove();
    expect(filter.select).toHaveBeenCalledWith("all");
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
