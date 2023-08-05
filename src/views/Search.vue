<template>
  <section>
    <v-toolbar variant="flat" color="transparent">
      <template #title>
        {{ $t('search') }}
      </template>
    </v-toolbar>
    <v-divider />
    <v-text-field id="searchInput" v-model="search" clearable prepend-inner-icon="mdi-magnify"
      :label="$t('type_to_search')" hide-details variant="filled" @focus="searchHasFocus = true"
      @blur="searchHasFocus = false" />

    <v-row v-for="rowSet in [ ['topresult', 'tracks'], ['artists', 'albums'], ['playlists', 'radio']]">
      <v-col v-for="resultKey in rowSet.filter(x => filteredItems(x).length)">
        <ItemsListing v-if="filteredItems(resultKey).length" 
          :itemtype="`search.${resultKey}`" :path="`search.${search}`"
          :show-provider="true" :show-favorites-only-filter="false" :show-select-button="false"
          :show-refresh-button="false" :load-items="async (params) => { return filteredItems(resultKey) }"
          :title="$t(resultKey)" :allow-key-hooks="false" :show-search-button="false" :limit="8" :infinite-scroll="false"
          :sort-keys="['original']" />
      </v-col>
    </v-row>
  </section>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-unused-vars,vue/no-setup-props-destructure */
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useDisplay } from 'vuetify';
import { SearchResults, type MediaItemType, BrowseFolder, MediaType } from '../plugins/api/interfaces';
import { store } from '../plugins/store';
import ItemsListing, { LoadDataParams } from '../components/ItemsListing.vue';
import PanelviewItem from '../components/PanelviewItem.vue';
import { useRouter } from 'vue-router';
import { api } from '../plugins/api';
import { eventbus } from '@/plugins/eventbus';
import { getBreakpointValue } from '@/plugins/breakpoint';
import { itemIsAvailable } from '@/helpers/contextmenu';

export interface Props {
  initSearch?: string;
}
const compProps = defineProps<Props>();


// local refs
const search = ref('');
const searchHasFocus = ref(false);
const searchResult = ref<SearchResults>();
const loading = ref(false);
const throttleId = ref();



// watchers
watch(
  () => search.value,
  () => {
    clearTimeout(throttleId.value);
    throttleId.value = setTimeout(() => {
      loadSearchResults();
    }, 200);
  },
);

const loadSearchResults = async function () {
  loading.value = true;
  localStorage.setItem('globalsearch', search.value);

  if (search.value) {
    searchResult.value = await api.search(search.value);
  } else {
    searchResult.value = undefined;
  }
  loading.value = false;
};


const filteredItems = function (itemType: string) {
  if (!searchResult.value) return [];

  if (itemType == 'artists') {
    return searchResult.value.artists;
  }
  if (itemType == 'albums') {
    return searchResult.value.albums;
  }
  if (itemType == 'tracks') {
    return searchResult.value.tracks;
  }
  if (itemType == 'playlists') {
    return searchResult.value.playlists;
  }
  if (itemType == 'radio') {
    return searchResult.value.radio;
  }
  if (itemType == 'topresult') {
    const result: MediaItemType[] = [];
    for (const results of [
      searchResult.value.tracks,
      searchResult.value.artists,
      searchResult.value.albums,
      searchResult.value.playlists,
      searchResult.value.radio,
    ]) {
      const seenProviders: string[] = [];
      for (const item of results) {
        if (!seenProviders.includes(item.provider)) {
          result.push(item);
          seenProviders.push(item.provider);
        }
      }
    }
    return result;
  }
  return [];
}

onMounted(() => {
  if (compProps.initSearch) {
    search.value = compProps.initSearch;
  } else {
    const savedSearch = localStorage.getItem('globalsearch');
    if (savedSearch && savedSearch !== 'null') {
      search.value = savedSearch;
    }
  }
});


// lifecycle hooks
const keyListener = function (e: KeyboardEvent) {
  if (!searchHasFocus.value && e.key == 'Backspace') {
    search.value = search.value.slice(0, -1);
  } else if (!searchHasFocus.value && e.key.length == 1) {
    search.value += e.key;
  }
};
document.addEventListener('keydown', keyListener);

onBeforeUnmount(() => {
  document.removeEventListener('keydown', keyListener);
});
</script>
