<template>
  <section>
    <Toolbar icon="mdi-magnify" :title="$t('search')" />

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
      <v-row
        v-for="rowSet in [
          ['topresult', 'tracks'],
          ['artists', 'albums'],
          ['playlists', 'radio'],
        ]"
        :key="rowSet[0] + rowSet[1]"
      >
        <v-col
          v-for="resultKey in rowSet.filter((x) => filteredItems(x).length)"
          :key="resultKey"
        >
          <ItemsListing
            v-if="filteredItems(resultKey).length"
            :itemtype="`search.${resultKey}`"
            :path="`search.${deferredSearch}`"
            :show-provider="true"
            :show-favorites-only-filter="false"
            :show-select-button="false"
            :show-refresh-button="false"
            :load-items="
              async (params) => {
                return filteredItems(resultKey);
              }
            "
            :title="$t(resultKey)"
            :allow-key-hooks="false"
            :show-search-button="false"
            :limit="8"
            :infinite-scroll="false"
            :sort-keys="[]"
          />
        </v-col>
      </v-row>
    </Container>
  </section>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-unused-vars,vue/no-setup-props-destructure */
import { ref, onBeforeUnmount, onMounted, watch } from 'vue';
import { SearchResults, type MediaItemType } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import ItemsListing from '@/components/ItemsListing.vue';
import Container from '@/components/mods/Container.vue';
import Toolbar from '@/components/Toolbar.vue';
import { api } from '@/plugins/api';

// local refs
const deferredSearch = ref();
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
      loadSearchResults();
    }, 200);
  },
  { immediate: true },
);

const loadSearchResults = async function () {
  loading.value = true;
  localStorage.setItem('globalsearch', store.globalSearchTerm || '');

  if (store.globalSearchTerm) {
    searchResult.value = await api.search(store.globalSearchTerm);
  } else {
    searchResult.value = undefined;
  }
  loading.value = false;
  deferredSearch.value = store.globalSearchTerm;
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
};

onMounted(() => {
  if (!store.globalSearchTerm) {
    const savedSearch = localStorage.getItem('globalsearch');
    if (savedSearch && savedSearch !== 'null') {
      store.globalSearchTerm = savedSearch;
    }
  }
});

// lifecycle hooks
const keyListener = function (e: KeyboardEvent) {
  if (!searchHasFocus.value && e.key == 'Backspace' && store.globalSearchTerm) {
    store.globalSearchTerm = store.globalSearchTerm.slice(0, -1);
  } else if (!searchHasFocus.value && e.key.length == 1) {
    store.globalSearchTerm += e.key;
  }
};
document.addEventListener('keydown', keyListener);

onBeforeUnmount(() => {
  document.removeEventListener('keydown', keyListener);
});
</script>
