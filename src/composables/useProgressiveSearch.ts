import { api } from "@/plugins/api";
import { providerServiceName } from "@/plugins/api/helpers";
import {
  Genre,
  MediaItem,
  MediaType,
  ProviderFeature,
  ProviderMapping,
  SearchResults,
  SortField,
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
  // selected search targets ("library" and/or provider target ids); an
  // empty selection searches all targets
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
  const selectedProvidersInput = options.providers ?? ref<string[]>([]);
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

  // the media type selection clamped to the allowed set
  const selectedMediaTypes = computed(() =>
    options.mediaTypes.value.filter((mediaType) =>
      allowedMediaTypes.includes(mediaType),
    ),
  );

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
          name: providerServiceName(provider),
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

  // the target selection with stale ids of removed providers dropped
  const selectedProviders = computed(() =>
    selectedProvidersInput.value.filter(
      (id) =>
        id === LIBRARY_SEARCH_TARGET ||
        providerTargets.value.some((target) => target.id === id),
    ),
  );

  // An empty selection searches everything: the library plus all providers.
  // A non-empty selection searches exactly the selected targets, so a
  // library-only search is possible too. Genres live in the library only, so
  // a genre-only search asks the library whatever the selection.
  const enabledTargetIds = computed(() => {
    if (genreOnly.value) return [LIBRARY_SEARCH_TARGET];
    const allTargetIds = [
      LIBRARY_SEARCH_TARGET,
      ...providerTargets.value.map((target) => target.id),
    ];
    const selected = selectedProviders.value;
    if (!selected.length) return allTargetIds;
    return allTargetIds.filter((id) => selected.includes(id));
  });

  // a target deselected while its request is still out no longer counts
  const loading = computed(() =>
    enabledTargetIds.value.some((id) => pendingTargets.value.has(id)),
  );

  // Merge like the server's combined search: library first, then the providers
  // round-robin without the items already in the library results, with exact
  // name matches floated to the top.
  const searchResult = computed<SearchResults | undefined>(() => {
    if (!activeSearchTerm.value) return undefined;
    const query = activeSearchTerm.value.toLowerCase().trim();
    const library = enabledTargetIds.value.includes(LIBRARY_SEARCH_TARGET)
      ? providerResults.value[LIBRARY_SEARCH_TARGET]
      : undefined;
    const providers = enabledTargetIds.value
      .filter((targetId) => targetId !== LIBRARY_SEARCH_TARGET)
      .map((targetId) => providerResults.value[targetId])
      .filter((result) => !!result);
    const collect = <T extends MediaItem>(
      pick: (result: SearchResults) => T[],
    ) => collectField(library, providers, pick, query);
    const merged: SearchResults = {
      artists: collect((r) => r.artists),
      albums: collect((r) => r.albums),
      tracks: collect((r) => r.tracks),
      playlists: collect((r) => r.playlists),
      radio: collect((r) => r.radio),
      podcasts: collect((r) => r.podcasts),
      audiobooks: collect((r) => r.audiobooks),
      genres: collect((r) => r.genres),
    };
    if (!merged.genres.length) merged.genres = [...libraryGenresFallback.value];
    return merged;
  });

  const search = async function (searchTerm?: string) {
    // a whitespace-only term is a reset, same as an empty one
    const trimmedTerm = searchTerm?.trim() || "";
    currentSearchId += 1;
    const searchId = currentSearchId;
    for (const timer of retryTimers.values()) clearTimeout(timer);
    retryTimers.clear();
    providerResults.value = {};
    pendingTargets.value = new Set();
    libraryGenresFallback.value = [];
    activeSearchTerm.value = trimmedTerm;
    if (!trimmedTerm) return;

    if (genreOnly.value) {
      // Genre-only search: use library search directly
      pendingTargets.value.add(LIBRARY_SEARCH_TARGET);
      try {
        const genres = await api.getLibraryGenres({
          search: trimmedTerm,
          limit: limits.single,
          offset: 0,
          sort_field: SortField.NAME,
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
    if (
      (!mediaTypes || mediaTypes.includes(MediaType.GENRE)) &&
      enabledTargetIds.value.includes(LIBRARY_SEARCH_TARGET)
    ) {
      // supplement the results with (library) genre results
      api
        .getLibraryGenres({
          search: trimmedTerm,
          limit: limits.multi,
          offset: 0,
          sort_field: SortField.NAME,
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
  !result.artists.length &&
  !result.albums.length &&
  !result.tracks.length &&
  !result.playlists.length &&
  !result.radio.length &&
  !result.podcasts.length &&
  !result.audiobooks.length &&
  !result.genres.length;

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

// Round-robin merge of the per-provider lists, like the server's zip_longest.
const interleave = function <T>(lists: T[][]): T[] {
  const items: T[] = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let index = 0; index < longest; index++) {
    for (const list of lists) {
      if (index < list.length) items.push(list[index]);
    }
  }
  return items;
};

const mappingKey = (mapping: ProviderMapping) =>
  `${mapping.provider_domain}:${mapping.item_id}`;

const collectField = function <T extends MediaItem>(
  library: SearchResults | undefined,
  providers: SearchResults[],
  pick: (result: SearchResults) => T[],
  query: string,
): T[] {
  const libraryItems = library ? pick(library) : [];
  // the library and each provider are searched separately, so a provider item
  // that maps to a library item would otherwise be listed twice
  const libraryMappings = new Set(
    libraryItems.flatMap((item) => item.provider_mappings.map(mappingKey)),
  );
  const providerItems = interleave(providers.map(pick)).filter(
    (item) =>
      !item.provider_mappings.some((mapping) =>
        libraryMappings.has(mappingKey(mapping)),
      ),
  );
  return floatExactMatches([...libraryItems, ...providerItems], query);
};
