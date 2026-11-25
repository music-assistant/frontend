import type { LoadDataParams } from "@/composables/useItemsListing";
import {
  SEARCH_DELAY_MS,
  useListingSearch,
} from "@/composables/useListingSearch";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, ref, watch, type EffectScope } from "vue";

let scope: EffectScope;

/** A listing's search, with the searches it makes in the order it makes them. */
function setupListingSearch(search = "") {
  const params = ref<LoadDataParams>({
    offset: 0,
    limit: 50,
    sortBy: "name",
    search,
  });
  const searches: string[] = [];
  const listingSearch = scope.run(() => {
    watch(
      () => params.value.search,
      (term) => searches.push(term),
      { flush: "sync" },
    );
    return useListingSearch(params);
  })!;
  return { params, searches, ...listingSearch };
}

describe("useListingSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
    vi.useRealTimers();
  });

  it("searches once for a word, after the last letter", () => {
    const { searchText, searches } = setupListingSearch();

    for (const text of ["a", "ab", "abb", "abba"]) {
      searchText.value = text;
      expect(searchText.value).toBe(text);
      vi.advanceTimersByTime(SEARCH_DELAY_MS - 1);
    }
    expect(searches).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(searches).toEqual(["abba"]);
    expect(searchText.value).toBe("abba");
  });

  it("empties the search right away", () => {
    const { searchText, searches } = setupListingSearch("abba");

    searchText.value = "";

    expect(searches).toEqual([""]);
  });

  it("searches for nothing when the text is emptied before it was searched", () => {
    const { searchText, searches } = setupListingSearch();

    searchText.value = "abba";
    searchText.value = "";
    vi.advanceTimersByTime(SEARCH_DELAY_MS);

    expect(searches).toEqual([]);
  });

  it("waits again for text typed right after emptying", () => {
    const { searchText, searches } = setupListingSearch();

    searchText.value = "abba";
    vi.advanceTimersByTime(SEARCH_DELAY_MS - 1);
    searchText.value = "";
    searchText.value = "b";
    vi.advanceTimersByTime(SEARCH_DELAY_MS - 1);
    expect(searches).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(searches).toEqual(["b"]);
  });

  it("shows a search the listing puts back after a typed one", () => {
    const { params, searchText } = setupListingSearch("abba");

    searchText.value = "beatles";
    vi.advanceTimersByTime(SEARCH_DELAY_MS);
    params.value.search = "abba";

    expect(searchText.value).toBe("abba");
  });

  it("goes back to the last search when the typed text is discarded", () => {
    const { searchText, discardTyped, searches } = setupListingSearch("abba");

    searchText.value = "abba gold";
    discardTyped();
    expect(searchText.value).toBe("abba");

    vi.advanceTimersByTime(SEARCH_DELAY_MS);
    expect(searches).toEqual([]);
  });

  it("leaves the params alone once the listing is gone", () => {
    const { params, searchText } = setupListingSearch();

    searchText.value = "abba";
    scope.stop();
    vi.advanceTimersByTime(SEARCH_DELAY_MS);

    expect(params.value.search).toBe("");
  });
});
