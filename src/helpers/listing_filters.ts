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

/** One narrowing that is in effect, shown as a removable chip. */
export interface ActiveFilterChip {
  key: string;
  label: string;
  // the filter a picked value belongs to, such as "Source" for "Spotify"
  group?: string;
  icon?: Component;
  remove: () => void;
}

const optionLabel = (options: ListingFilterOption[], value: string) =>
  options.find((option) => option.value === value)?.label ?? value;

/** The chips for every narrowing the filters put on the listing. */
export function activeFilterChips(
  filters: ListingFilter[],
): ActiveFilterChip[] {
  return filters.flatMap((filter): ActiveFilterChip[] => {
    switch (filter.kind) {
      case "toggle":
        return filter.active
          ? [
              {
                key: filter.id,
                label: filter.label,
                icon: filter.icon,
                remove: filter.toggle,
              },
            ]
          : [];
      case "multi":
        return filter.selected.map((value) => ({
          key: `${filter.id}:${value}`,
          label: optionLabel(filter.options, value),
          group: filter.label,
          remove: () => filter.toggle(value),
        }));
      case "choice":
        return filter.selected === filter.unfiltered
          ? []
          : [
              {
                key: filter.id,
                label: optionLabel(filter.options, filter.selected),
                remove: () => filter.select(filter.unfiltered),
              },
            ];
    }
  });
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
