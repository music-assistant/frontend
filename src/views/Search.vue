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
import {
  LIBRARY_SEARCH_TARGET,
  SEARCHABLE_MEDIA_TYPES,
  useProgressiveSearch,
} from "@/composables/useProgressiveSearch";
import { useUserPreferences } from "@/composables/userPreferences";
import { panelViewItemResponsive } from "@/helpers/utils";
import { itemIsAvailable } from "@/plugins/api/helpers";
import { MediaType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

// local refs
const searchHasFocus = ref(false);
const throttleId = ref();
const listingRef = ref<InstanceType<typeof ItemsListing>>();
let listingReloadTimer: ReturnType<typeof setTimeout> | undefined;
const { getPreference, setPreference } = useUserPreferences();
// search targets stored as the included subset; empty means all targets
const selectedProvidersPref = getPreference<string[]>(
  "globalSearchProviders",
  [],
);

// Responsive tile sizing, shared curve with the rest of the app.
const tilesPerView = computed(() => panelViewItemResponsive(0) + 0.5);

const selectedMediaTypes = computed<MediaType[]>({
  get: () => store.globalSearchMediaTypes,
  set: (val) => {
    store.globalSearchMediaTypes = val;
  },
});

const mediaTypeOptions = computed(() =>
  SEARCHABLE_MEDIA_TYPES.map((mediaType) => ({
    label: $t(mediaType + "s"),
    value: mediaType,
  })),
);

const storedProviders = computed<string[]>(() =>
  Array.isArray(selectedProvidersPref.value) ? selectedProvidersPref.value : [],
);

const {
  loading,
  searchResult,
  providerTargets,
  selectedProviders,
  singleType,
  genreOnly,
  search,
  filteredItems,
} = useProgressiveSearch({
  mediaTypes: selectedMediaTypes,
  providers: storedProviders,
});

const selectedSearchProviders = computed<string[]>({
  // the composable drops stale ids of removed providers from the selection
  get: () => selectedProviders.value,
  set: (val) => {
    setPreference("globalSearchProviders", val);
  },
});

const providerOptions = computed(() => [
  { label: $t("library"), value: LIBRARY_SEARCH_TARGET },
  ...providerTargets.value.map((target) => ({
    label: target.name,
    value: target.id,
  })),
]);

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
      setPreference("globalSearch", store.globalSearchTerm || "");
      search(store.globalSearchTerm);
    }, 1000);
  },
  { immediate: true },
);
// selection changes re-search via the composable; only persist them here
watch(
  () => store.globalSearchMediaTypes.join(","),
  () => {
    setPreference("globalSearchMediaTypes", store.globalSearchMediaTypes);
  },
);
// The single-media-type listing pulls its items through the load-items
// callback; nudge it to reload when new provider results stream in (coalesced,
// results arrive in bursts).
watch(searchResult, () => {
  if (!singleType.value) return;
  clearTimeout(listingReloadTimer);
  listingReloadTimer = setTimeout(() => listingRef.value?.reload(), 150);
});

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
});
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
