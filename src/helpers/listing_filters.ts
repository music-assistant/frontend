import type { LoadDataParams } from "@/composables/useItemsListing";
import type { ItemsListingPreferences } from "@/composables/userPreferences";
import type { Component } from "vue";

/** One value a filter offers. */
export interface ListingFilterOption {
  label: string;
  value: string;
  // the provider whose icon marks the option, on a source filter
  domain?: string;
}

/** A filter that is either on or off, such as "Only favorites". */
export interface ListingToggleFilter {
  kind: "toggle";
  id: string;
  label: string;
  icon: Component;
  active: boolean;
  toggle: () => void;
}

/** A filter that keeps the items matching any of the picked values. */
export interface ListingMultiFilter {
  kind: "multi";
  id: string;
  label: string;
  // stands in for the picked values while there are none
  placeholder: string;
  // a few options read best as checkboxes, a long list as a dropdown
  layout: "checkboxes" | "dropdown";
  options: ListingFilterOption[];
  selected: string[];
  toggle: (value: string) => void;
  // takes a whole selection in one go, as a dropdown hands it back
  set?: (values: string[]) => void;
}

/** A filter with exactly one of a few choices picked. */
export interface ListingChoiceFilter {
  kind: "choice";
  id: string;
  label: string;
  options: ListingFilterOption[];
  selected: string;
  // the choice that leaves the listing unfiltered
  unfiltered: string;
  select: (value: string) => void;
}

export type ListingFilter =
  ListingToggleFilter | ListingMultiFilter | ListingChoiceFilter;

/** How many narrowings the filters put on the listing: one per active
 * toggle, picked value or narrowing choice. */
export function activeFilterCount(filters: ListingFilter[]): number {
  return filters.reduce((count, filter) => {
    switch (filter.kind) {
      case "toggle":
        return count + Number(filter.active);
      case "multi":
        return count + filter.selected.length;
      case "choice":
        return count + Number(filter.selected !== filter.unfiltered);
    }
  }, 0);
}

interface ListingCountSource {
  // the count the page fetched, if it has one
  total?: number;
  loaded: number;
  allLoaded: boolean;
  // a filter is on that the page's count request does not take
  narrowedBeyondTotal: boolean;
}

/**
 * The item count a listing can stand behind, or undefined when it does not
 * know one. A fully loaded listing counts what it holds, which also follows
 * deletions. Otherwise the page's count stands, unless a narrowing its count
 * request is not told about makes it wrong.
 */
export function listingItemCount(source: ListingCountSource) {
  // every item is on screen, so counting them beats any total fetched earlier
  if (source.allLoaded) return source.loaded;
  return source.narrowedBeyondTotal ? undefined : source.total;
}

// what Clear all puts each offered filter back to, on the listing and in its
// saved settings
const FILTER_RESETS: {
  id: string;
  param: keyof LoadDataParams;
  pref: keyof ItemsListingPreferences;
  value: () => boolean | string[] | undefined;
}[] = [
  {
    id: "favorites",
    param: "favoritesOnly",
    pref: "favoriteFilter",
    value: () => false,
  },
  {
    id: "album_artists",
    param: "albumArtistsFilter",
    pref: "albumArtistsFilter",
    value: () => false,
  },
  {
    id: "library_only",
    param: "libraryOnly",
    pref: "libraryFilter",
    value: () => false,
  },
  {
    id: "hide_fully_played",
    param: "hideFullyPlayed",
    pref: "hideFullyPlayedFilter",
    value: () => false,
  },
  {
    id: "collapse_collections",
    param: "collapseCollections",
    pref: "collapseCollections",
    value: () => false,
  },
  // hiding empty genres is where the genres listing starts
  {
    id: "genres_shown",
    param: "hideEmptyFilter",
    pref: "hideEmptyFilter",
    value: () => true,
  },
  { id: "album_type", param: "albumType", pref: "albumType", value: () => [] },
  {
    id: "provider",
    param: "provider",
    pref: "providerFilter",
    value: () => undefined,
  },
];

/**
 * What Clear all sets for the filters a listing offers, by their ids: the
 * listing's params and the settings to save in one go. A cleared source is
 * there as undefined, which drops it from the saved settings. The genre lives
 * in the address instead, which the listing clears itself.
 */
export function clearedFilters(offered: ReadonlySet<string>) {
  const params: Record<string, unknown> = {};
  const prefs: Record<string, unknown> = {};
  for (const reset of FILTER_RESETS) {
    if (!offered.has(reset.id)) continue;
    params[reset.param] = reset.value();
    prefs[reset.pref] = reset.value();
  }
  return {
    params: params as Partial<LoadDataParams>,
    prefs: prefs as Partial<ItemsListingPreferences>,
  };
}
