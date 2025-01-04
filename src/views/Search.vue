<template>
  <section>
    <Toolbar icon="mdi-magnify" :title="$t('global_search')" />

    <Container variant="default">
      <v-text-field
        id="searchInput"
        v-model="store.globalSearchTerm"
        clearable
        prepend-inner-icon="mdi-magnify"
        :label="$t('type_to_search')"
        hide-details
        variant="outlined"
        @focus="searchHasFocus = true"
        @blur="searchHasFocus = false"
      />

      <v-chip-group
        v-model="store.globalSearchType"
        style="margin-top: 10px; margin-left: 10px"
      >
        <v-chip
          v-for="item in [
            undefined,
            MediaType.TRACK,
            MediaType.ARTIST,
            MediaType.ALBUM,
            MediaType.PLAYLIST,
            MediaType.PODCAST,
            MediaType.AUDIOBOOK,
            MediaType.RADIO,
          ]"
          :key="item"
          :text="$t(item ? item + 's' : 'searchtype_all')"
          :value="item"
        />
      </v-chip-group>

      <v-progress-circular
        v-if="loading"
        color="primary"
        indeterminate
        :title="$t('tooltip.loading')"
      />

      <!-- compact all-media-types searchresult -->
      <div v-if="!store.globalSearchType">
        <HomeWidgetRow
          v-if="searchResult && !loading"
          :widget-row="{
            label: 'tracks',
            icon: 'mdi-file-music',
            items: searchResult.tracks,
            count: searchResult.tracks.length,
          }"
        />
        <HomeWidgetRow
          v-if="searchResult && !loading"
          :widget-row="{
            label: 'artists',
            icon: 'mdi-account-music',
            items: searchResult.artists,
            count: searchResult.artists.length,
          }"
        />
        <HomeWidgetRow
          v-if="searchResult && !loading"
          :widget-row="{
            label: 'albums',
            icon: 'mdi-album',
            items: searchResult.albums,
            count: searchResult.albums.length,
          }"
        />
        <HomeWidgetRow
          v-if="searchResult && !loading"
          :widget-row="{
            label: 'playlists',
            icon: 'mdi-playlist-music',
            items: searchResult.playlists,
            count: searchResult.playlists.length,
          }"
        />
        <HomeWidgetRow
          v-if="searchResult && !loading"
          :widget-row="{
            label: 'podcasts',
            icon: 'mdi-podcast',
            items: searchResult.podcasts,
            count: searchResult.podcasts.length,
          }"
        />
        <HomeWidgetRow
          v-if="searchResult && !loading"
          :widget-row="{
            label: 'audiobooks',
            icon: 'mdi-book-play-outline',
            items: searchResult.audiobooks,
            count: searchResult.audiobooks.length,
          }"
        />
        <HomeWidgetRow
          v-if="searchResult && !loading"
          :widget-row="{
            label: 'radios',
            icon: 'mdi-radio',
            items: searchResult.radio,
            count: searchResult.radio.length,
          }"
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
import { ref, onBeforeUnmount, onMounted, watch } from "vue";
import { MediaType, SearchResults } from "@/plugins/api/interfaces";
import HomeWidgetRow from "@/components/HomeWidgetRow.vue";
import { store } from "@/plugins/store";
import ItemsListing from "@/components/ItemsListing.vue";
import Container from "@/components/mods/Container.vue";
import Toolbar from "@/components/Toolbar.vue";
import { api } from "@/plugins/api";

// local refs
const searchHasFocus = ref(false);
const searchResult = ref<SearchResults>();
const loading = ref(false);
const throttleId = ref();

// watchers
watch(
  () => store.globalSearchTerm,
  () => {
    clearTimeout(throttleId.value);
    throttleId.value = setTimeout(() => {
      loadSearchResults(store.globalSearchTerm, store.globalSearchType);
    }, 500);
  },
  { immediate: true },
);
watch(
  () => store.globalSearchType,
  () => {
    loadSearchResults(store.globalSearchTerm, store.globalSearchType);
  },
);

const loadSearchResults = async function (
  searchTerm?: string,
  filter?: MediaType,
) {
  loading.value = true;
  localStorage.setItem("globalsearch", searchTerm || "");
  const limit = store.globalSearchType ? 50 : 8;
  const mediaTypes = filter ? [filter] : undefined;
  if (searchTerm) {
    searchResult.value = await api.search(searchTerm, mediaTypes, limit);
  } else {
    searchResult.value = undefined;
  }
  loading.value = false;
};

onMounted(() => {
  if (!store.globalSearchTerm) {
    const savedSearch = localStorage.getItem("globalsearch");
    if (savedSearch && savedSearch !== "null") {
      store.globalSearchTerm = savedSearch;
    }
  }
});

// lifecycle hooks
const keyListener = function (e: KeyboardEvent) {
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
  return [];
};
</script>
