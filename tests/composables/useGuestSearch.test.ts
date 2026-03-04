import { MediaType, type Artist, type Track } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSearch, mockGetArtistTracks, mockSortByRelevance, mockToast } =
  vi.hoisted(() => {
    return {
      mockSearch: vi.fn(),
      mockGetArtistTracks: vi.fn(),
      mockSortByRelevance: vi.fn(<T>(items: T[], _query: string): T[] => items),
      mockToast: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
      },
    };
  });

vi.mock("@/plugins/api", () => ({
  default: {
    search: mockSearch,
    getArtistTracks: mockGetArtistTracks,
  },
}));

vi.mock("@/helpers/relevanceScoring", () => ({
  sortByRelevance: mockSortByRelevance,
}));

vi.mock("vue-sonner", () => ({
  toast: mockToast,
}));

import { useGuestSearch } from "@/composables/useGuestSearch";

describe("useGuestSearch", () => {
  beforeEach(() => {
    mockSearch.mockReset();
    mockGetArtistTracks.mockReset();
    mockSortByRelevance.mockClear();
    mockToast.success.mockReset();
    mockToast.error.mockReset();
    mockToast.warning.mockReset();
    mockToast.info.mockReset();
  });

  it("performs search with correct media types for 'all' filter", async () => {
    mockSearch.mockResolvedValueOnce({
      tracks: [{ type: "track", id: "t1" }],
      artists: [{ type: "artist", id: "a1" }],
    });

    const {
      searchQuery,
      searchFilter,
      searchResults,
      displayedResultsCount,
      performSearch,
    } = useGuestSearch();

    searchQuery.value = "test";
    searchFilter.value = "all";

    await performSearch();

    expect(mockSearch).toHaveBeenCalledWith("test", [
      MediaType.TRACK,
      MediaType.ARTIST,
    ]);
    expect(mockSortByRelevance).toHaveBeenCalledTimes(1);
    expect(searchResults.value).toHaveLength(2);
    expect(displayedResultsCount.value).toBe(10);
  });

  it("performs search with track-only filter", async () => {
    mockSearch.mockResolvedValueOnce({
      tracks: [{ type: "track", id: "t1" }],
      artists: [{ type: "artist", id: "a1" }],
    });

    const { searchQuery, searchFilter, searchResults, performSearch } =
      useGuestSearch();

    searchQuery.value = "track search";
    searchFilter.value = "track";

    await performSearch();

    expect(mockSearch).toHaveBeenCalledWith("track search", [MediaType.TRACK]);
    expect(searchResults.value).toHaveLength(1);
    const typedResults = searchResults.value as unknown as Array<{
      type: string;
    }>;
    expect(typedResults.every((item) => item.type === "track")).toBe(true);
  });

  it("handles search errors and shows snackbar", async () => {
    mockSearch.mockRejectedValueOnce(new Error("Search failed"));

    const { searchQuery, performSearch, searching, hasSearched } =
      useGuestSearch();

    searchQuery.value = "error";

    await performSearch();

    expect(mockToast.error).toHaveBeenCalledWith($t("providers.party_mode.guest_page.search_failed"));
    expect(searching.value).toBe(false);
    expect(hasSearched.value).toBe(true);
  });

  it("clears search state correctly", async () => {
    mockSearch.mockResolvedValueOnce({
      tracks: [{ type: "track", id: "t1" }],
      artists: [],
    });

    const {
      searchQuery,
      searchResults,
      displayedResultsCount,
      selectedArtist,
      artistTracks,
      hasSearched,
      performSearch,
      clearSearch,
    } = useGuestSearch();

    searchQuery.value = "something";
    await performSearch();

    hasSearched.value = true;
    selectedArtist.value = {} as unknown as Artist;
    artistTracks.value = [{} as unknown as Track];

    clearSearch();

    expect(searchQuery.value).toBe("");
    expect(searchResults.value).toEqual([]);
    expect(displayedResultsCount.value).toBe(10);
    expect(hasSearched.value).toBe(false);
    expect(selectedArtist.value).toBeNull();
    expect(artistTracks.value).toEqual([]);
  });

  it("selects artist and loads tracks", async () => {
    const tracks = [{ id: "track1" }, { id: "track2" }];
    mockGetArtistTracks.mockResolvedValueOnce(tracks);

    const { selectedArtist, artistTracks, loadingArtistTracks, selectArtist } =
      useGuestSearch();

    const artist = {
      provider_mappings: [
        { item_id: "artist-id", provider_instance: "provider-1" },
      ],
    } as unknown as Artist;

    await selectArtist(artist);

    expect(loadingArtistTracks.value).toBe(false);
    expect(selectedArtist.value).toStrictEqual(artist);
    expect(mockGetArtistTracks).toHaveBeenCalledWith("artist-id", "provider-1");
    expect(artistTracks.value).toEqual(tracks);
  });

  it("handles artist selection errors and shows snackbar", async () => {
    mockGetArtistTracks.mockRejectedValueOnce(
      new Error("Failed to load tracks"),
    );

    const { selectedArtist, artistTracks, loadingArtistTracks, selectArtist } =
      useGuestSearch();

    const artist = {
      provider_mappings: [
        { item_id: "artist-id", provider_instance: "provider-1" },
      ],
    } as unknown as Artist;

    await selectArtist(artist);

    expect(loadingArtistTracks.value).toBe(false);
    expect(selectedArtist.value).toBeNull();
    expect(artistTracks.value).toEqual([]);
    expect(mockToast.error).toHaveBeenCalledWith(
      $t("providers.party_mode.guest_page.load_artist_tracks_failed"),
    );
  });

  it("loads more results when scrolling near the bottom", async () => {
    mockSearch.mockResolvedValueOnce({
      tracks: Array.from({ length: 30 }, (_, i) => ({
        type: "track",
        id: `t${i}`,
      })),
      artists: [],
    });

    const {
      searchQuery,
      searchResults,
      displayedResultsCount,
      performSearch,
      handleScroll,
    } = useGuestSearch();

    searchQuery.value = "scroll";
    await performSearch();

    expect(searchResults.value.length).toBe(30);
    expect(displayedResultsCount.value).toBe(10);

    const target = {
      scrollTop: 900,
      clientHeight: 100,
      scrollHeight: 1000,
    } as unknown as HTMLElement;

    const event = { target } as unknown as Event;
    handleScroll(event);

    expect(displayedResultsCount.value).toBeGreaterThan(10);
  });
});
