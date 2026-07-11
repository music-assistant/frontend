import { api } from "@/plugins/api";
import {
  Genre,
  MediaType,
  ProviderFeature,
  SearchResults,
} from "@/plugins/api/interfaces";
import { computed, onScopeDispose, ref, watch, type Ref } from "vue";

// virtual search target for the server's library search
export const LIBRARY_SEARCH_TARGET = "library";

export const SEARCHABLE_MEDIA_TYPES = [
  MediaType.TRACK,
  MediaType.ARTIST,
  MediaType.ALBUM,
  MediaType.PLAYLIST,
  MediaType.PODCAST,
  MediaType.AUDIOBOOK,
  MediaType.RADIO,
  MediaType.GENRE,
];

// The server answers each per-provider search request within a soft timeout;
// a provider that is slower returns an empty result while its search continues
// in the background server-side (and gets cached once done). An empty result
// that took at least this long is treated as such a soft timeout and retried
// shortly after, picking up the cached result.
const SOFT_TIMEOUT_MS = 7000;
const SOFT_TIMEOUT_RETRY_DELAY_MS = 2500;
const MAX_SOFT_TIMEOUT_RETRIES = 3;

export interface SearchTarget {
  // instance_id for local providers, domain for streaming providers
  id: string;
  name: string;
  iconDomain: string;
}

export interface ProgressiveSearchOptions {
  // selected media types; an empty selection searches all allowed types
  mediaTypes: Ref<MediaType[]>;
  // selected provider target ids; an empty selection searches all targets
  providers?: Ref<string[]>;
  // media types this consumer can search at all (default: all searchable)
  allowedMediaTypes?: MediaType[];
  // per-target result limit: single = exactly one media type selected
  limits?: { single: number; multi: number };
}

/**
 * Progressive multi-provider media search.
 *
 * Fires one search request per target (the library plus every selectable
 * provider) and merges the results into the reactive `searchResult` as each
 * target responds, library results first. Targets mirror the server's
 * provider de-duplication and slow providers are retried automatically to
 * pick up their server-side cached result. Call `search(term)` to start a
 * new search (an empty term resets); selection changes on the given
 * `mediaTypes`/`providers` refs re-search automatically.
 */
export function useProgressiveSearch(options: ProgressiveSearchOptions) {
  const selectedMediaTypes = options.mediaTypes;
  const selectedProvidersInput = options.providers ?? ref([]);
  const allowedMediaTypes = options.allowedMediaTypes ?? SEARCHABLE_MEDIA_TYPES;
  const limits = options.limits ?? { single: 50, multi: 8 };

  const activeSearchTerm = ref("");
  const providerResults = ref<{ [targetId: string]: SearchResults }>({});
  const pendingTargets = ref(new Set<string>());
  const libraryGenresFallback = ref<Genre[]>([]);
  const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // guards stale responses: bumped on every new search, responses for an
  // older search id are discarded
  let currentSearchId = 0;

  const loading = computed(() => pendingTargets.value.size > 0);

  // exactly one selected media type: consumers typically show a single flat
  // listing for this and a per-type split otherwise
  const singleType = computed(() =>
    selectedMediaTypes.value.length === 1
      ? selectedMediaTypes.value[0]
      : undefined,
  );

  // genres live in the library only, so a genre-only search skips the providers
  const genreOnly = computed(() => singleType.value === MediaType.GENRE);

  // the media types actually sent with a search request; undefined = all
  const effectiveMediaTypes = computed<MediaType[] | undefined>(() => {
    if (selectedMediaTypes.value.length) return selectedMediaTypes.value;
    if (allowedMediaTypes.length < SEARCHABLE_MEDIA_TYPES.length)
      return allowedMediaTypes;
    return undefined;
  });

  // All selectable search targets, mirroring the server's provider
  // de-duplication: streaming providers are collapsed to one target per domain
  // (the server only ever searches a single instance of the same streaming
  // service), local/plugin providers get one target per instance.
  const providerTargets = computed<SearchTarget[]>(() => {
    const targets: SearchTarget[] = [];
    const seenStreamingDomains = new Set<string>();
    for (const provider of Object.values(api.providers)) {
      if (!provider.available) continue;
      if (!provider.supported_features.includes(ProviderFeature.SEARCH))
        continue;
      if (provider.is_streaming_provider) {
        if (seenStreamingDomains.has(provider.domain)) continue;
        seenStreamingDomains.add(provider.domain);
        targets.push({
          id: provider.domain,
          name: api.providerManifests[provider.domain]?.name || provider.name,
          iconDomain: provider.domain,
        });
      } else {
        targets.push({
          id: provider.instance_id,
          name: provider.name,
          iconDomain: provider.domain,
        });
      }
    }
    return targets.sort((a, b) => a.name.localeCompare(b.name));
  });

  // the provider selection with stale ids of removed providers dropped
  const selectedProviders = computed(() =>
    selectedProvidersInput.value.filter((id) =>
      providerTargets.value.some((target) => target.id === id),
    ),
  );

  // The library is always searched; an empty provider selection means all.
  const enabledTargetIds = computed(() => {
    const selected = selectedProviders.value;
    return [
      LIBRARY_SEARCH_TARGET,
      ...providerTargets.value
        .filter((target) => !selected.length || selected.includes(target.id))
        .map((target) => target.id),
    ];
  });

  // Merge the per-target results in a stable order (library first, then
  // providers) and float exact name matches to the top, approximating the
  // ranking of the server's combined search.
  const searchResult = computed<SearchResults | undefined>(() => {
    if (!activeSearchTerm.value) return undefined;
    const query = activeSearchTerm.value.toLowerCase().trim();
    const ordered = enabledTargetIds.value
      .map((targetId) => providerResults.value[targetId])
      .filter((result) => !!result);
    const merged: SearchResults = {
      artists: collectField(ordered, (r) => r.artists, query),
      albums: collectField(ordered, (r) => r.albums, query),
      tracks: collectField(ordered, (r) => r.tracks, query),
      playlists: collectField(ordered, (r) => r.playlists, query),
      radio: collectField(ordered, (r) => r.radio, query),
      podcasts: collectField(ordered, (r) => r.podcasts, query),
      audiobooks: collectField(ordered, (r) => r.audiobooks, query),
      genres: collectField(ordered, (r) => r.genres, query),
    };
    if (!merged.genres.length) merged.genres = [...libraryGenresFallback.value];
    return merged;
  });

  const search = async function (searchTerm?: string) {
    currentSearchId += 1;
    const searchId = currentSearchId;
    for (const timer of retryTimers.values()) clearTimeout(timer);
    retryTimers.clear();
    providerResults.value = {};
    pendingTargets.value = new Set();
    libraryGenresFallback.value = [];
    activeSearchTerm.value = searchTerm || "";
    if (!searchTerm) return;

    if (genreOnly.value) {
      // Genre-only search: use library search directly
      pendingTargets.value.add(LIBRARY_SEARCH_TARGET);
      try {
        const genres = await api.getLibraryGenres({
          search: searchTerm,
          limit: limits.single,
          offset: 0,
          order_by: "name",
        });
        if (searchId !== currentSearchId) return;
        providerResults.value[LIBRARY_SEARCH_TARGET] = {
          ...emptyResults(),
          genres,
        };
      } catch (err) {
        console.error("Genre search failed", err);
      }
      if (searchId === currentSearchId) {
        pendingTargets.value.delete(LIBRARY_SEARCH_TARGET);
      }
      return;
    }

    const mediaTypes = effectiveMediaTypes.value;
    if (!mediaTypes || mediaTypes.includes(MediaType.GENRE)) {
      // supplement the results with (library) genre results
      api
        .getLibraryGenres({
          search: searchTerm,
          limit: limits.multi,
          offset: 0,
          order_by: "name",
        })
        .then((genres) => {
          if (searchId === currentSearchId)
            libraryGenresFallback.value = genres;
        })
        .catch((err) => console.error("Genre search failed", err));
    }
    ensureTargetResults();
  };

  const filteredItems = function (mediaType: MediaType) {
    if (!searchResult.value) return [];
    if (mediaType == MediaType.TRACK) return searchResult.value.tracks;
    if (mediaType == MediaType.ARTIST) return searchResult.value.artists;
    if (mediaType == MediaType.ALBUM) return searchResult.value.albums;
    if (mediaType == MediaType.PLAYLIST) return searchResult.value.playlists;
    if (mediaType == MediaType.PODCAST) return searchResult.value.podcasts;
    if (mediaType == MediaType.AUDIOBOOK) return searchResult.value.audiobooks;
    if (mediaType == MediaType.RADIO) return searchResult.value.radio;
    if (mediaType == MediaType.GENRE) return searchResult.value.genres;
    return [];
  };

  // Fire a search for every enabled target that has no result yet; used on
  // search start, on selection changes and when providers (re)connect.
  const ensureTargetResults = function () {
    if (!activeSearchTerm.value) return;
    if (genreOnly.value) return;
    for (const targetId of enabledTargetIds.value) {
      if (providerResults.value[targetId]) continue;
      if (pendingTargets.value.has(targetId)) continue;
      searchTarget(currentSearchId, targetId);
    }
  };

  // One search request for a single target (library or one provider); the
  // response is merged into the view as soon as it arrives.
  const searchTarget = async function (
    searchId: number,
    targetId: string,
    attempt = 0,
  ) {
    if (searchId !== currentSearchId) return;
    const limit = singleType.value ? limits.single : limits.multi;
    const mediaTypes = effectiveMediaTypes.value;
    pendingTargets.value.add(targetId);
    const started = Date.now();
    let result: SearchResults | undefined;
    try {
      result = await api.search(activeSearchTerm.value, mediaTypes, limit, [
        targetId,
      ]);
    } catch (err) {
      console.error(`Search on ${targetId} failed`, err);
    }
    if (searchId !== currentSearchId) return;
    if (
      result &&
      isEmptyResult(result) &&
      Date.now() - started >= SOFT_TIMEOUT_MS &&
      attempt < MAX_SOFT_TIMEOUT_RETRIES
    ) {
      // soft timeout: the provider search continues in the background
      // server-side, retry shortly to pick up the cached result
      retryTimers.set(
        targetId,
        setTimeout(() => {
          retryTimers.delete(targetId);
          searchTarget(searchId, targetId, attempt + 1);
        }, SOFT_TIMEOUT_RETRY_DELAY_MS),
      );
      return;
    }
    providerResults.value[targetId] = result || emptyResults();
    pendingTargets.value.delete(targetId);
  };

  // media type selection changes affect limits and per-request media types:
  // rerun the whole search
  watch(
    () => selectedMediaTypes.value.join(","),
    () => search(activeSearchTerm.value),
  );
  // selection changes and (re)connected providers: search any enabled target
  // that has no result yet for the active query
  watch(
    () => enabledTargetIds.value.join(","),
    () => ensureTargetResults(),
  );

  onScopeDispose(() => {
    for (const timer of retryTimers.values()) clearTimeout(timer);
    retryTimers.clear();
  });

  return {
    activeSearchTerm,
    loading,
    pendingTargets,
    searchResult,
    providerTargets,
    selectedProviders,
    singleType,
    genreOnly,
    search,
    filteredItems,
  };
}

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

const isEmptyResult = (result: SearchResults): boolean =>
  !result.artists?.length &&
  !result.albums?.length &&
  !result.tracks?.length &&
  !result.playlists?.length &&
  !result.radio?.length &&
  !result.podcasts?.length &&
  !result.audiobooks?.length &&
  !result.genres?.length;

// Keeps the relative order but floats items whose name matches the query
// exactly, so a late provider with the exact hit still lands on top.
const floatExactMatches = function <T extends { name?: string }>(
  items: T[],
  query: string,
): T[] {
  if (items.length < 2 || !query) return items;
  const exact: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    (item.name?.toLowerCase() === query ? exact : rest).push(item);
  }
  return exact.length ? exact.concat(rest) : items;
};

const collectField = function <T extends { name?: string }>(
  results: SearchResults[],
  pick: (result: SearchResults) => T[] | undefined,
  query: string,
): T[] {
  const items: T[] = [];
  for (const result of results) items.push(...(pick(result) || []));
  return floatExactMatches(items, query);
};
