import {
  MediaType,
  ProviderFeature,
  type SearchResults,
  type Track,
} from "@/plugins/api/interfaces";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref, type EffectScope } from "vue";

const { mockSearch, mockGetLibraryGenres, mockProviders, mockManifests } =
  vi.hoisted(() => {
    return {
      mockSearch: vi.fn(),
      mockGetLibraryGenres: vi.fn(),
      mockProviders: {} as Record<string, unknown>,
      mockManifests: {} as Record<string, unknown>,
    };
  });

vi.mock("@/plugins/api", () => ({
  api: {
    providers: mockProviders,
    providerManifests: mockManifests,
    search: mockSearch,
    getLibraryGenres: mockGetLibraryGenres,
  },
}));

import {
  LIBRARY_SEARCH_TARGET,
  useProgressiveSearch,
  type ProgressiveSearchOptions,
} from "@/composables/useProgressiveSearch";

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

const track = (itemId: string, name: string): Track =>
  ({
    item_id: itemId,
    name,
    uri: `test://track/${itemId}`,
    media_type: MediaType.TRACK,
  }) as Track;

const provider = (
  instanceId: string,
  domain: string,
  name: string,
  overrides: Record<string, unknown> = {},
) => ({
  instance_id: instanceId,
  domain,
  name,
  available: true,
  is_streaming_provider: false,
  supported_features: [ProviderFeature.SEARCH],
  ...overrides,
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("useProgressiveSearch", () => {
  const scopes: EffectScope[] = [];

  const setup = function (options: Partial<ProgressiveSearchOptions> = {}) {
    const mediaTypes = options.mediaTypes ?? ref<MediaType[]>([]);
    const scope = effectScope();
    scopes.push(scope);
    const composable = scope.run(() =>
      useProgressiveSearch({ ...options, mediaTypes }),
    )!;
    return { ...composable, mediaTypes };
  };

  beforeEach(() => {
    mockSearch.mockReset();
    mockSearch.mockResolvedValue(emptyResults());
    mockGetLibraryGenres.mockReset();
    mockGetLibraryGenres.mockResolvedValue([]);
    for (const key of Object.keys(mockProviders)) delete mockProviders[key];
    for (const key of Object.keys(mockManifests)) delete mockManifests[key];
    Object.assign(mockProviders, {
      "spotify-a": provider("spotify-a", "spotify", "Spotify A", {
        is_streaming_provider: true,
      }),
      "spotify-b": provider("spotify-b", "spotify", "Spotify B", {
        is_streaming_provider: true,
      }),
      fs1: provider("fs1", "filesystem_local", "Filesystem music"),
      offline: provider("offline", "tidal", "Tidal", {
        is_streaming_provider: true,
        available: false,
      }),
      nosearch: provider("nosearch", "sonos", "Sonos", {
        supported_features: [],
      }),
    });
    Object.assign(mockManifests, {
      spotify: { name: "Spotify" },
      filesystem_local: { name: "Filesystem" },
    });
  });

  afterEach(() => {
    while (scopes.length) scopes.pop()!.stop();
    vi.useRealTimers();
  });

  it("collapses streaming providers per domain and skips unusable providers", () => {
    const { providerTargets } = setup();

    expect(providerTargets.value).toEqual([
      { id: "fs1", name: "Filesystem music", iconDomain: "filesystem_local" },
      { id: "spotify", name: "Spotify", iconDomain: "spotify" },
    ]);
  });

  it("fires one request per target and merges results library first", async () => {
    mockSearch.mockImplementation(
      (_query, _mediaTypes, _limit, providers: string[]) => {
        if (providers[0] === LIBRARY_SEARCH_TARGET)
          return Promise.resolve(results({ tracks: [track("l1", "Lib hit")] }));
        if (providers[0] === "spotify")
          return Promise.resolve(
            results({ tracks: [track("s1", "Spotify hit")] }),
          );
        return Promise.resolve(emptyResults());
      },
    );
    const { search, searchResult, loading } = setup();

    await search("hit");
    await flush();

    const requestedTargets = mockSearch.mock.calls.map(
      (call) => call[3],
    ) as string[][];
    expect(requestedTargets).toEqual(
      expect.arrayContaining([[LIBRARY_SEARCH_TARGET], ["fs1"], ["spotify"]]),
    );
    expect(searchResult.value?.tracks.map((item) => item.name)).toEqual([
      "Lib hit",
      "Spotify hit",
    ]);
    expect(loading.value).toBe(false);
  });

  it("floats exact name matches above earlier fuzzy results", async () => {
    mockSearch.mockImplementation(
      (_query, _mediaTypes, _limit, providers: string[]) => {
        if (providers[0] === LIBRARY_SEARCH_TARGET)
          return Promise.resolve(
            results({ tracks: [track("l1", "Queen tribute")] }),
          );
        if (providers[0] === "spotify")
          return Promise.resolve(results({ tracks: [track("s1", "Queen")] }));
        return Promise.resolve(emptyResults());
      },
    );
    const { search, searchResult } = setup();

    await search("queen");
    await flush();

    expect(searchResult.value?.tracks.map((item) => item.name)).toEqual([
      "Queen",
      "Queen tribute",
    ]);
  });

  it("passes the selected media types and the single-type limit", async () => {
    const mediaTypes = ref<MediaType[]>([MediaType.TRACK]);
    const { search } = setup({
      mediaTypes,
      limits: { single: 50, multi: 8 },
    });

    await search("query");
    await flush();

    expect(mockSearch).toHaveBeenCalledWith(
      "query",
      [MediaType.TRACK],
      50,
      expect.anything(),
    );
  });

  it("clamps the selection and requests to the allowed media types", async () => {
    const mediaTypes = ref<MediaType[]>([MediaType.RADIO]);
    const { search, singleType } = setup({
      mediaTypes,
      allowedMediaTypes: [MediaType.TRACK, MediaType.PLAYLIST],
    });

    // out-of-scope selection is ignored: all allowed types are searched
    expect(singleType.value).toBeUndefined();
    await search("query");
    await flush();

    expect(mockSearch).toHaveBeenCalledWith(
      "query",
      [MediaType.TRACK, MediaType.PLAYLIST],
      8,
      expect.anything(),
    );
  });

  it("discards responses of a superseded search", async () => {
    let resolveFirst!: (value: SearchResults) => void;
    mockSearch.mockImplementation((query: string) => {
      if (query === "first")
        return new Promise<SearchResults>((resolve) => {
          resolveFirst = resolve;
        });
      return Promise.resolve(results({ tracks: [track("t2", "Second")] }));
    });
    const { search, searchResult } = setup();

    await search("first");
    await search("second");
    resolveFirst(results({ tracks: [track("t1", "First")] }));
    await flush();

    expect(searchResult.value?.tracks.map((item) => item.name)).toEqual([
      "Second",
      "Second",
      "Second",
    ]);
  });

  it("retries a provider that hit the server's soft timeout", async () => {
    vi.useFakeTimers();
    let spotifyCalls = 0;
    mockSearch.mockImplementation(
      (_query, _mediaTypes, _limit, providers: string[]) => {
        if (providers[0] !== "spotify") return Promise.resolve(emptyResults());
        spotifyCalls += 1;
        if (spotifyCalls === 1) {
          // empty response only after the soft timeout elapsed
          return new Promise<SearchResults>((resolve) =>
            setTimeout(() => resolve(emptyResults()), 8000),
          );
        }
        return Promise.resolve(results({ tracks: [track("s1", "Late")] }));
      },
    );
    const { search, searchResult, loading } = setup();

    await search("late");
    await vi.advanceTimersByTimeAsync(8000);
    expect(spotifyCalls).toBe(1);
    expect(loading.value).toBe(true);

    await vi.advanceTimersByTimeAsync(2500);
    expect(spotifyCalls).toBe(2);
    expect(searchResult.value?.tracks.map((item) => item.name)).toEqual([
      "Late",
    ]);
    expect(loading.value).toBe(false);
  });

  it("searches only the library for a genre-only search", async () => {
    const genres = [{ item_id: "g1", name: "Rock" }];
    mockGetLibraryGenres.mockResolvedValue(genres);
    const mediaTypes = ref<MediaType[]>([MediaType.GENRE]);
    const { search, searchResult } = setup({ mediaTypes });

    await search("rock");
    await flush();

    expect(mockSearch).not.toHaveBeenCalled();
    expect(mockGetLibraryGenres).toHaveBeenCalledWith(
      expect.objectContaining({ search: "rock", limit: 50 }),
    );
    expect(searchResult.value?.genres).toEqual(genres);
  });

  it("treats a whitespace-only term as a reset", async () => {
    const { search, searchResult, activeSearchTerm } = setup();

    await search("   ");
    await flush();

    expect(mockSearch).not.toHaveBeenCalled();
    expect(activeSearchTerm.value).toBe("");
    expect(searchResult.value).toBeUndefined();
  });

  it("searches exactly the selected targets and drops stale provider ids", async () => {
    const providers = ref(["spotify", "removed-provider"]);
    const { search, selectedProviders } = setup({ providers });

    expect(selectedProviders.value).toEqual(["spotify"]);
    await search("query");
    await flush();

    const requestedTargets = mockSearch.mock.calls
      .map((call) => (call[3] as string[])[0])
      .sort();
    expect(requestedTargets).toEqual(["spotify"]);
  });

  it("searches only the library when just the library is selected", async () => {
    const providers = ref([LIBRARY_SEARCH_TARGET]);
    const { search, selectedProviders } = setup({ providers });

    expect(selectedProviders.value).toEqual([LIBRARY_SEARCH_TARGET]);
    await search("query");
    await flush();

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith("query", undefined, 8, [
      LIBRARY_SEARCH_TARGET,
    ]);
  });

  it("searches a newly selected provider for the active query", async () => {
    const providers = ref(["fs1"]);
    const { search } = setup({ providers });

    await search("query");
    await flush();
    expect(mockSearch).toHaveBeenCalledTimes(1); // fs1 only

    providers.value = ["fs1", "spotify"];
    await nextTick();
    await flush();

    expect(mockSearch).toHaveBeenCalledTimes(2);
    expect(mockSearch).toHaveBeenLastCalledWith("query", undefined, 8, [
      "spotify",
    ]);
  });
});
