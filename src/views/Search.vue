<template>
  <section>
    <Container variant="default" style="padding-top: 20px">
      <div class="relative">
        <SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id="searchInput"
          v-model="store.globalSearchTerm"
          :placeholder="$t('type_to_search')"
          class="pl-9 pr-9"
          @focus="searchHasFocus = true"
          @blur="searchHasFocus = false"
        />
        <button
          v-if="store.globalSearchTerm"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          @click="store.globalSearchTerm = ''"
        >
          <XIcon class="h-4 w-4" />
        </button>
      </div>

      <div class="flex flex-wrap gap-2 mt-2.5 ml-2.5">
        <Badge
          v-for="item in [
            SEARCH_TYPE_ALL,
            MediaType.TRACK,
            MediaType.ARTIST,
            MediaType.ALBUM,
            MediaType.PLAYLIST,
            MediaType.PODCAST,
            MediaType.AUDIOBOOK,
            MediaType.RADIO,
            MediaType.GENRE,
          ]"
          :key="item"
          :variant="selectedSearchType === item ? 'default' : 'outline'"
          class="cursor-pointer"
          @click="selectedSearchType = item"
        >
          {{ $t(item === SEARCH_TYPE_ALL ? 'searchtype_all' : item + 's') }}
        </Badge>
      </div>

      <div
        v-if="loading"
        class="mt-4 h-1 w-full overflow-hidden rounded-full bg-primary/20"
      >
        <div class="h-full w-1/3 rounded-full bg-primary animate-[indeterminate_1.5s_ease-in-out_infinite]" />
      </div>

      <!-- compact all-media-types searchresult -->
      <div v-if="!store.globalSearchType">
        <WidgetRow
          v-if="searchResult && !loading"
          :widget-row="{
            title: $t('tracks'),
            icon: 'mdi-file-music',
            items: searchResult.tracks,
          }"
          :show-provider-on-cover="true"
        />
        <WidgetRow
          v-if="searchResult && !loading"
          :widget-row="{
            title: $t('artists'),
            icon: 'mdi-account-music',
            items: searchResult.artists,
          }"
          :show-provider-on-cover="true"
        />
        <WidgetRow
          v-if="searchResult && !loading"
          :widget-row="{
            title: $t('albums'),
            icon: 'mdi-album',
            items: searchResult.albums,
          }"
          :show-provider-on-cover="true"
        />
        <WidgetRow
          v-if="searchResult && !loading"
          :widget-row="{
            title: $t('playlists'),
            icon: 'mdi-playlist-music',
            items: searchResult.playlists,
          }"
          :show-provider-on-cover="true"
        />
        <WidgetRow
          v-if="searchResult && !loading"
          :widget-row="{
            title: $t('podcasts'),
            icon: 'mdi-podcast',
            items: searchResult.podcasts,
          }"
          :show-provider-on-cover="true"
        />
        <WidgetRow
          v-if="searchResult && !loading"
          :widget-row="{
            title: $t('audiobooks'),
            icon: 'mdi-book-play-outline',
            items: searchResult.audiobooks,
          }"
          :show-provider-on-cover="true"
        />
        <WidgetRow
          v-if="searchResult && !loading"
          :widget-row="{
            title: $t('radios'),
            icon: 'mdi-radio',
            items: searchResult.radio,
          }"
          :show-provider-on-cover="true"
        />
        <WidgetRow
          v-if="searchResult && !loading"
          :widget-row="{
            title: $t('genres'),
            icon: GenreIcon,
            items: searchResult.genres,
          }"
          :show-provider-on-cover="true"
        />
      </div>
      <!-- tracks-only searchresult -->
      <div v-else-if="!loading">
        <ItemsListing
          :itemtype="`${store.globalSearchType}s`"
          :show-provider="true"
          :show-favorites-only-filter="false"
          :show-select-button="false"
          :show-refresh-button="false"
          :load-items="
            async (params) => {
              return filteredItems(store.globalSearchType!);
            }
          "
          :title="$t(`${store.globalSearchType}s`)"
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
/* eslint-disable @typescript-eslint/no-unused-vars,vue/no-setup-props-destructure */
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Container from "@/components/Container.vue";
import GenreIcon from "@/components/icons/GenreIcon.vue";
import ItemsListing from "@/components/ItemsListing.vue";
import WidgetRow from "@/components/WidgetRow.vue";
import { useUserPreferences } from "@/composables/userPreferences";
import { api } from "@/plugins/api";
import { MediaType, SearchResults } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { Search as SearchIcon, X as XIcon } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const SEARCH_TYPE_ALL = "all";

// computed to bridge between chip-group (needs a real value) and store (uses undefined for "all")
const selectedSearchType = computed({
  get: () => store.globalSearchType || SEARCH_TYPE_ALL,
  set: (val: string) => {
    store.globalSearchType =
      val === SEARCH_TYPE_ALL ? undefined : (val as MediaType);
  },
});

// local refs
const searchHasFocus = ref(false);
const searchResult = ref<SearchResults>();
const loading = ref(false);
const throttleId = ref();
const { getPreference, setPreference } = useUserPreferences();

// watchers
watch(
  () => store.globalSearchTerm,
  () => {
    clearTimeout(throttleId.value);
    throttleId.value = setTimeout(() => {
      loadSearchResults(store.globalSearchTerm, store.globalSearchType);
    }, 1000);
  },
  { immediate: true },
);
watch(
  () => store.globalSearchType,
  () => {
    setPreference(
      "globalSearchType",
      store.globalSearchType || SEARCH_TYPE_ALL,
    );
    loadSearchResults(store.globalSearchTerm, store.globalSearchType);
  },
);

const loadSearchResults = async function (
  searchTerm?: string,
  filter?: MediaType,
) {
  loading.value = true;
  setPreference("globalSearch", searchTerm || "");
  const limit = store.globalSearchType ? 50 : 8;
  const mediaTypes = filter ? [filter] : undefined;
  if (searchTerm) {
    if (filter === MediaType.GENRE) {
      // Genre-only search: use library search directly
      const genres = await api.getLibraryGenres({
        search: searchTerm,
        limit,
        offset: 0,
        order_by: "name",
      });
      searchResult.value = {
        artists: [],
        albums: [],
        tracks: [],
        playlists: [],
        radio: [],
        podcasts: [],
        audiobooks: [],
        genres,
      };
    } else {
      // Standard search + supplement with genre results
      const [results, genres] = await Promise.all([
        api.search(searchTerm, mediaTypes, limit),
        !filter
          ? api.getLibraryGenres({
              search: searchTerm,
              limit,
              offset: 0,
              order_by: "name",
            })
          : Promise.resolve([]),
      ]);
      searchResult.value = {
        ...results,
        genres: results.genres?.length ? results.genres : genres,
      };
    }
  } else {
    searchResult.value = undefined;
  }
  loading.value = false;
};

onMounted(() => {
  if (!store.globalSearchTerm) {
    const savedSearch = getPreference<string>("globalSearch").value;
    if (savedSearch && savedSearch !== "null") {
      store.globalSearchTerm = savedSearch;
    }
  }
  const savedSearchType = getPreference<string>("globalSearchType").value;
  if (
    savedSearchType &&
    savedSearchType !== "null" &&
    savedSearchType !== SEARCH_TYPE_ALL
  ) {
    store.globalSearchType = savedSearchType as MediaType;
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
</script>

<style scoped>
@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}
</style>
