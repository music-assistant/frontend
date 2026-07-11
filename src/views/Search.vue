<template>
  <section>
    <Container variant="default" style="padding-top: 20px">
      <SearchInput
        id="searchInput"
        v-model="store.globalSearchTerm"
        clearable
        :aria-label="$t('search')"
        :placeholder="$t('type_to_search')"
        @focus="searchHasFocus = true"
        @blur="searchHasFocus = false"
      />

      <!-- faceted filters (like the settings pages): media type(s) and
           search target(s); an empty selection means no filtering -->
      <div class="search-filter-row">
        <FacetedFilter
          v-model="selectedMediaTypes"
          :title="$t('media_type')"
          :options="mediaTypeOptions"
        />
        <FacetedFilter
          v-if="providerTargets.length && !genreOnly"
          v-model="selectedSearchProviders"
          :title="$t('settings.providers')"
          :options="providerOptions"
        />
      </div>

      <v-progress-linear
        v-if="loading"
        color="accent"
        height="4"
        indeterminate
        rounded
        style="margin-top: 15px"
      />

      <!-- compact searchresult shelves per media type -->
      <div v-if="!singleType" class="search-shelves">
        <EditorialShelf
          v-for="section in searchSections"
          :key="section.key"
          :title="section.title"
          :tiles-per-view="tilesPerView"
        >
          <EditorialMediaCard
            v-for="item in section.items"
            :key="item.uri"
            :item="item"
            :show-provider-on-cover="true"
            :is-available="itemIsAvailable(item)"
          />
        </EditorialShelf>
      </div>
      <!-- single media type searchresult; mounted as soon as the first
           target returns items so slower providers merge in progressively -->
      <div v-else-if="searchResult && (singleTypeHasItems || !loading)">
        <ItemsListing
          ref="listingRef"
          :itemtype="`${singleType}s`"
          :show-provider="true"
          :show-favorites-only-filter="false"
          :show-select-button="false"
          :show-refresh-button="false"
          :load-items="
            async (params) => {
              return filteredItems(singleType!);
            }
          "
          :title="$t(`${singleType}s`)"
          :allow-key-hooks="false"
          :show-search-button="false"
          :infinite-scroll="true"
          :sort-keys="[]"
          style="padding: 0"
        />
      </div>
    </Container>
  </section>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import EditorialMediaCard from "@/components/discover/EditorialMediaCard.vue";
import EditorialShelf from "@/components/discover/EditorialShelf.vue";
import FacetedFilter from "@/components/FacetedFilter.vue";
import ItemsListing from "@/components/ItemsListing.vue";
import { SearchInput } from "@/components/ui/search-input";
import { useUserPreferences } from "@/composables/userPreferences";
import { panelViewItemResponsive } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { itemIsAvailable } from "@/plugins/api/helpers";
import {
  Genre,
  MediaType,
  ProviderFeature,
  SearchResults,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

// virtual search target for the server's library search
const LIBRARY_TARGET = "library";

const SEARCHABLE_MEDIA_TYPES = [
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

interface SearchTarget {
  // instance_id for local providers, domain for streaming providers
  id: string;
  name: string;
  iconDomain: string;
}

// local refs
const searchHasFocus = ref(false);
const activeSearchTerm = ref("");
const providerResults = ref<{ [targetId: string]: SearchResults }>({});
const pendingTargets = ref(new Set<string>());
const libraryGenresFallback = ref<Genre[]>([]);
const throttleId = ref();
const listingRef = ref<InstanceType<typeof ItemsListing>>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
let listingReloadTimer: ReturnType<typeof setTimeout> | undefined;
// guards stale responses: bumped on every new search, responses for an older
// search id are discarded
let currentSearchId = 0;
const { getPreference, setPreference } = useUserPreferences();
// search targets stored as the included subset; empty means all targets
const selectedProvidersPref = getPreference<string[]>(
  "globalSearchProviders",
  [],
);

const loading = computed(() => pendingTargets.value.size > 0);

// Responsive tile sizing, shared curve with the rest of the app.
const tilesPerView = computed(() => panelViewItemResponsive(0) + 0.5);

const selectedMediaTypes = computed<string[]>({
  get: () => store.globalSearchMediaTypes,
  set: (val) => {
    store.globalSearchMediaTypes = val as MediaType[];
  },
});

const mediaTypeOptions = computed(() =>
  SEARCHABLE_MEDIA_TYPES.map((mediaType) => ({
    label: $t(mediaType + "s"),
    value: mediaType,
  })),
);

// exactly one selected media type: results are shown as a single listing
const singleType = computed(() =>
  store.globalSearchMediaTypes.length === 1
    ? store.globalSearchMediaTypes[0]
    : undefined,
);

// genres live in the library only, so a genre-only search skips the providers
const genreOnly = computed(() => singleType.value === MediaType.GENRE);

// All selectable search targets, mirroring the server's provider
// de-duplication: streaming providers are collapsed to one target per domain
// (the server only ever searches a single instance of the same streaming
// service), local/plugin providers get one target per instance.
const providerTargets = computed<SearchTarget[]>(() => {
  const targets: SearchTarget[] = [];
  const seenStreamingDomains = new Set<string>();
  for (const provider of Object.values(api.providers)) {
    if (!provider.available) continue;
    if (!provider.supported_features.includes(ProviderFeature.SEARCH)) continue;
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

const providerOptions = computed(() => [
  // the library is always searched, shown as a locked entry
  { label: $t("library"), value: LIBRARY_TARGET, locked: true },
  ...providerTargets.value.map((target) => ({
    label: target.name,
    value: target.id,
  })),
]);

const selectedSearchProviders = computed<string[]>({
  // ignore stale ids of removed providers so the filter count stays accurate
  get: () => {
    const stored = Array.isArray(selectedProvidersPref.value)
      ? selectedProvidersPref.value
      : [];
    return stored.filter((id) =>
      providerTargets.value.some((target) => target.id === id),
    );
  },
  set: (val) => {
    setPreference("globalSearchProviders", val);
  },
});

// The library is always searched; an empty provider selection means all.
const enabledTargetIds = computed(() => {
  const selected = selectedSearchProviders.value;
  return [
    LIBRARY_TARGET,
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

const singleTypeHasItems = computed(
  () => !!singleType.value && filteredItems(singleType.value).length > 0,
);

// Compact results as horizontal shelves, restricted to the selected media
// types; empty categories are hidden.
const searchSections = computed(() => {
  const r = searchResult.value;
  if (!r) return [];
  const selected = store.globalSearchMediaTypes;
  return [
    {
      key: "tracks",
      type: MediaType.TRACK,
      title: $t("tracks"),
      items: r.tracks,
    },
    {
      key: "artists",
      type: MediaType.ARTIST,
      title: $t("artists"),
      items: r.artists,
    },
    {
      key: "albums",
      type: MediaType.ALBUM,
      title: $t("albums"),
      items: r.albums,
    },
    {
      key: "playlists",
      type: MediaType.PLAYLIST,
      title: $t("playlists"),
      items: r.playlists,
    },
    {
      key: "podcasts",
      type: MediaType.PODCAST,
      title: $t("podcasts"),
      items: r.podcasts,
    },
    {
      key: "audiobooks",
      type: MediaType.AUDIOBOOK,
      title: $t("audiobooks"),
      items: r.audiobooks,
    },
    {
      key: "radios",
      type: MediaType.RADIO,
      title: $t("radios"),
      items: r.radio,
    },
    {
      key: "genres",
      type: MediaType.GENRE,
      title: $t("genres"),
      items: r.genres,
    },
  ].filter(
    (s) => s.items?.length && (!selected.length || selected.includes(s.type)),
  );
});

// watchers
watch(
  () => store.globalSearchTerm,
  () => {
    clearTimeout(throttleId.value);
    throttleId.value = setTimeout(() => {
      loadSearchResults(store.globalSearchTerm);
    }, 1000);
  },
  { immediate: true },
);
watch(
  () => store.globalSearchMediaTypes.join(","),
  () => {
    setPreference("globalSearchMediaTypes", store.globalSearchMediaTypes);
    loadSearchResults(store.globalSearchTerm);
  },
);
// selection changes and (re)connected providers: search any enabled target
// that has no result yet for the active query
watch(
  () => enabledTargetIds.value.join(","),
  () => ensureTargetResults(),
);
// The single-media-type listing pulls its items through the load-items
// callback; nudge it to reload when new provider results stream in (coalesced,
// results arrive in bursts).
watch(searchResult, () => {
  if (!singleType.value) return;
  clearTimeout(listingReloadTimer);
  listingReloadTimer = setTimeout(() => listingRef.value?.reload(), 150);
});

const loadSearchResults = async function (searchTerm?: string) {
  currentSearchId += 1;
  const searchId = currentSearchId;
  for (const timer of retryTimers.values()) clearTimeout(timer);
  retryTimers.clear();
  providerResults.value = {};
  pendingTargets.value = new Set();
  libraryGenresFallback.value = [];
  activeSearchTerm.value = searchTerm || "";
  setPreference("globalSearch", searchTerm || "");
  if (!searchTerm) return;

  if (genreOnly.value) {
    // Genre-only search: use library search directly
    pendingTargets.value.add(LIBRARY_TARGET);
    try {
      const genres = await api.getLibraryGenres({
        search: searchTerm,
        limit: 50,
        offset: 0,
        order_by: "name",
      });
      if (searchId !== currentSearchId) return;
      providerResults.value[LIBRARY_TARGET] = { ...emptyResults(), genres };
    } catch (err) {
      console.error("Genre search failed", err);
    }
    if (searchId === currentSearchId) {
      pendingTargets.value.delete(LIBRARY_TARGET);
    }
    return;
  }

  const mediaTypes = store.globalSearchMediaTypes;
  if (!mediaTypes.length || mediaTypes.includes(MediaType.GENRE)) {
    // supplement the shelves with (library) genre results
    api
      .getLibraryGenres({
        search: searchTerm,
        limit: 8,
        offset: 0,
        order_by: "name",
      })
      .then((genres) => {
        if (searchId === currentSearchId) libraryGenresFallback.value = genres;
      })
      .catch((err) => console.error("Genre search failed", err));
  }
  ensureTargetResults();
};

onMounted(() => {
  if (!store.globalSearchTerm) {
    const savedSearch = getPreference<string>("globalSearch").value;
    if (savedSearch && savedSearch !== "null") {
      store.globalSearchTerm = savedSearch;
    }
  }
  // restore the media type filter, unless it was just set deliberately
  // (e.g. redirected here from a library listing's search)
  if (!store.globalSearchMediaTypes.length) {
    const savedTypes = getPreference<MediaType[]>(
      "globalSearchMediaTypes",
    ).value;
    // legacy single-type preference from the previous chip selector
    const legacyType = getPreference<string>("globalSearchType").value;
    if (Array.isArray(savedTypes)) {
      store.globalSearchMediaTypes = savedTypes.filter((mediaType) =>
        SEARCHABLE_MEDIA_TYPES.includes(mediaType),
      );
    } else if (
      legacyType &&
      SEARCHABLE_MEDIA_TYPES.includes(legacyType as MediaType)
    ) {
      store.globalSearchMediaTypes = [legacyType as MediaType];
    }
  }
});

// lifecycle hooks
const keyListener = function (e: KeyboardEvent) {
  // Ignore keyboard events with modifier keys
  if (e.ctrlKey || e.altKey || e.metaKey) {
    return;
  }

  if (store.showPlayersMenu) {
    return;
  }

  if (!searchHasFocus.value && e.key == "Backspace" && store.globalSearchTerm) {
    store.globalSearchTerm = store.globalSearchTerm.slice(0, -1);
  } else if (!searchHasFocus.value && e.key.length == 1) {
    store.globalSearchTerm += e.key;
  }
};
document.addEventListener("keyup", keyListener);

onBeforeUnmount(() => {
  document.removeEventListener("keyup", keyListener);
  clearTimeout(throttleId.value);
  clearTimeout(listingReloadTimer);
  for (const timer of retryTimers.values()) clearTimeout(timer);
  retryTimers.clear();
});

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
  const selectedTypes = store.globalSearchMediaTypes;
  const limit = singleType.value ? 50 : 8;
  const mediaTypes = selectedTypes.length ? selectedTypes : undefined;
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
</script>

<style scoped>
.search-filter-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 20px;
}
</style>
