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
 * know one. A narrowing the page's count request is not told about makes that
 * count wrong, and then only a fully loaded listing knows how many it holds.
 */
export function listingItemCount(source: ListingCountSource) {
  if (!source.narrowedBeyondTotal && source.total !== undefined) {
    return source.total;
  }
  return source.allLoaded ? source.loaded : undefined;
}
