import {
  MediaType,
  ProviderFeature,
  type Artist,
  type SearchResults,
  type Track,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { effectScope, type EffectScope } from "vue";

const {
  mockSearch,
  mockGetArtistTracks,
  mockGetLibraryGenres,
  mockSortByRelevance,
  mockToast,
  mockProviders,
  mockManifests,
} = vi.hoisted(() => {
  return {
    mockSearch: vi.fn(),
    mockGetArtistTracks: vi.fn(),
    mockGetLibraryGenres: vi.fn(),
    mockSortByRelevance: vi.fn(<T>(items: T[], _query: string): T[] => items),
    mockToast: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
    mockProviders: {} as Record<string, unknown>,
    mockManifests: {} as Record<string, unknown>,
  };
});

vi.mock("@/plugins/api", () => {
  const mockApi = {
    providers: mockProviders,
    providerManifests: mockManifests,
    search: mockSearch,
    getLibraryGenres: mockGetLibraryGenres,
    getArtistTracks: mockGetArtistTracks,
  };
  return { api: mockApi, default: mockApi };
});

vi.mock("@/helpers/relevanceScoring", () => ({
  sortByRelevance: mockSortByRelevance,
}));

vi.mock("vue-sonner", () => ({
  toast: mockToast,
}));

import { useGuestSearch } from "@/composables/useGuestSearch";

const emptyResults = (): SearchResults => ({
  artists: [],
  albums: [],
  tracks: [],
  playlists: [],
  radio: [],
  podcasts: [],
  audiobooks: [],
  genres: [],
});

const results = (partial: Partial<SearchResults>): SearchResults => ({
  ...emptyResults(),
  ...partial,
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("useGuestSearch", () => {
  const scopes: EffectScope[] = [];

  const setup = function () {
    const scope = effectScope();
    scopes.push(scope);
    return scope.run(() => useGuestSearch())!;
  };

  beforeEach(() => {
    mockSearch.mockReset();
    mockSearch.mockResolvedValue(emptyResults());
    mockGetArtistTracks.mockReset();
    mockGetLibraryGenres.mockReset();
    mockGetLibraryGenres.mockResolvedValue([]);
    mockSortByRelevance.mockClear();
    mockToast.success.mockReset();
    mockToast.error.mockReset();
    mockToast.warning.mockReset();
    mockToast.info.mockReset();
    for (const key of Object.keys(mockProviders)) delete mockProviders[key];
    for (const key of Object.keys(mockManifests)) delete mockManifests[key];
  });

  afterEach(() => {
    while (scopes.length) scopes.pop()!.stop();
  });

  it("performs search with correct media types for 'all' filter", async () => {
    mockSearch.mockResolvedValueOnce(
      results({
        tracks: [{ type: "track", id: "t1" } as unknown as Track],
        artists: [{ type: "artist", id: "a1" } as unknown as Artist],
      }),
    );

    const {
      searchQuery,
      searchFilter,
      searchResults,
      displayedResultsCount,
      performSearch,
    } = setup();

    searchQuery.value = "test";
    searchFilter.value = "all";

    performSearch();
    await flush();

    expect(mockSearch).toHaveBeenCalledWith(
      "test",
      [MediaType.TRACK, MediaType.ARTIST],
      25,
      ["library"],
    );
    expect(searchResults.value).toHaveLength(2);
    expect(displayedResultsCount.value).toBe(10);
  });

  it("performs search with track-only filter", async () => {
    mockSearch.mockResolvedValue(
      results({
        tracks: [{ type: "track", id: "t1" } as unknown as Track],
        artists: [{ type: "artist", id: "a1" } as unknown as Artist],
      }),
    );

    const { searchQuery, searchFilter, searchResults, performSearch } = setup();

    searchQuery.value = "track search";
    searchFilter.value = "track";

    performSearch();
    await flush();

    expect(mockSearch).toHaveBeenCalledWith(
      "track search",
      [MediaType.TRACK],
      25,
      ["library"],
    );
    expect(searchResults.value).toHaveLength(1);
    const typedResults = searchResults.value as unknown as Array<{
      type: string;
    }>;
    expect(typedResults.every((item) => item.type === "track")).toBe(true);
  });

  it("shows results from fast providers while slower ones are searching", async () => {
    mockProviders["spotify1"] = {
      instance_id: "spotify1",
      domain: "spotify",
      name: "Spotify",
      available: true,
      is_streaming_provider: true,
      supported_features: [ProviderFeature.SEARCH],
    };
    mockManifests["spotify"] = { name: "Spotify" };
    let resolveSpotify!: (value: SearchResults) => void;
    mockSearch.mockImplementation(
      (_query, _mediaTypes, _limit, providers: string[]) => {
        if (providers[0] === "library")
          return Promise.resolve(
            results({
              tracks: [{ type: "track", id: "lib1" } as unknown as Track],
            }),
          );
        return new Promise<SearchResults>((resolve) => {
          resolveSpotify = resolve;
        });
      },
    );

    const { searchQuery, searchResults, searching, performSearch } = setup();

    searchQuery.value = "progressive";
    performSearch();
    await flush();

    // the library result is visible while spotify is still searching
    expect(searchResults.value).toHaveLength(1);
    expect(searching.value).toBe(true);

    resolveSpotify(
      results({
        tracks: [{ type: "track", id: "sp1" } as unknown as Track],
      }),
    );
    await flush();

    expect(searchResults.value).toHaveLength(2);
    expect(searching.value).toBe(false);
  });

  it("collapses the same item from multiple providers into one row", async () => {
    mockProviders["spotify1"] = {
      instance_id: "spotify1",
      domain: "spotify",
      name: "Spotify",
      available: true,
      is_streaming_provider: true,
      supported_features: [ProviderFeature.SEARCH],
    };
    mockManifests["spotify"] = { name: "Spotify" };
    mockSearch.mockImplementation(
      (_query, _mediaTypes, _limit, providers: string[]) =>
        Promise.resolve(
          results({
            artists: [
              {
                media_type: MediaType.ARTIST,
                name: "Queen",
                provider: providers[0],
              } as unknown as Artist,
            ],
          }),
        ),
    );

    const { searchQuery, searchResults, performSearch } = setup();

    searchQuery.value = "queen";
    performSearch();
    await flush();

    // one "Queen" row remains and it is the library one (merged first)
    expect(searchResults.value).toHaveLength(1);
    expect((searchResults.value[0] as Artist).provider).toBe("library");
  });

  it("handles search errors gracefully", async () => {
    mockSearch.mockRejectedValueOnce(new Error("Search failed"));

    const {
      searchQuery,
      searchResults,
      performSearch,
      searching,
      hasSearched,
    } = setup();

    searchQuery.value = "error";

    performSearch();
    await flush();

    expect(searchResults.value).toEqual([]);
    expect(searching.value).toBe(false);
    expect(hasSearched.value).toBe(true);
  });

  it("clears search state correctly", async () => {
    mockSearch.mockResolvedValueOnce(
      results({
        tracks: [{ type: "track", id: "t1" } as unknown as Track],
      }),
    );

    const {
      searchQuery,
      searchResults,
      displayedResultsCount,
      selectedArtist,
      artistTracks,
      hasSearched,
      performSearch,
      clearSearch,
    } = setup();

    searchQuery.value = "something";
    performSearch();
    await flush();

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
      setup();

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
      setup();

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
      $t("providers.party.guest_page.load_artist_tracks_failed"),
    );
  });

  it("loads more results when scrolling near the bottom", async () => {
    mockSearch.mockResolvedValueOnce(
      results({
        tracks: Array.from(
          { length: 30 },
          (_, i) => ({ type: "track", id: `t${i}` }) as unknown as Track,
        ),
      }),
    );

    const {
      searchQuery,
      searchResults,
      displayedResultsCount,
      performSearch,
      handleScroll,
    } = setup();

    searchQuery.value = "scroll";
    performSearch();
    await flush();

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
