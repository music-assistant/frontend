<!-- eslint-disable vue/no-v-for-template-key-on-child -->
<template>
  <section v-if="!(hideOnEmpty && allItems.length == 0)">
    <!-- eslint-disable vue/no-template-shadow -->

    <MediaItemContextMenu
      v-model="showContextMenu"
      :items="selectedItems"
      :parent-item="parentItem"
      @clear="onClearSelection"
      @delete="onDelete"
    />
    <v-card>
      <v-toolbar density="compact" variant="flat" color="transparent">
        <template #title>
          {{ title }}
          <v-badge
            color="grey"
            :content="selectedItems.length ? `${selectedItems.length}/${totalItems}` : totalItems"
            inline
          />
        </template>

        <template #append>
          <!-- toggle select button -->
          <v-btn
            v-if="showSelectButton != undefined ? showSelectButton : getBreakpointValue('bp1') || !title"
            v-bind="props"
            :icon="showCheckboxes ? 'mdi-checkbox-multiple-outline' : 'mdi-checkbox-multiple-blank-outline'"
            variant="plain"
            :title="$t('tooltip.select_items')"
            @click="toggleCheckboxes"
          />

          <!-- favorites only filter -->
          <v-btn
            v-if="showFavoritesOnlyFilter !== false"
            v-bind="props"
            icon
            variant="plain"
            :title="$t('tooltip.filter_favorites')"
            @click="toggleFavoriteFilter"
          >
            <v-icon :icon="favoritesOnly ? 'mdi-heart' : 'mdi-heart-outline'" />
          </v-btn>

          <!-- album artists only filter -->
          <v-btn
            v-if="showAlbumArtistsOnlyFilter"
            v-bind="props"
            icon
            variant="plain"
            :title="$t('tooltip.album_artist_filter')"
            @click="toggleAlbumArtistsFilter"
          >
            <v-icon :icon="albumArtistsOnlyFilter ? 'mdi-account-music' : 'mdi-account-music-outline'" />
          </v-btn>

          <!-- refresh button-->
          <v-btn
            v-if="showRefreshButton != undefined ? showRefreshButton : getBreakpointValue('bp1') || !title"
            v-bind="props"
            icon
            variant="plain"
            :title="updateAvailable ? $t('tooltip.refresh_new_content') : $t('tooltip.refresh')"
            @click="onRefreshClicked()"
          >
            <v-badge :model-value="updateAvailable" color="error" dot>
              <v-icon icon="mdi-refresh" />
            </v-badge>
          </v-btn>

          <!-- sort options -->
          <v-menu
            v-if="sortKeys.length > 1"
            v-model="showSortMenu"
            location="bottom end"
            :close-on-content-click="true"
          >
            <template #activator="{ props }">
              <v-btn icon v-bind="props" variant="plain" :title="$t('tooltip.sort_options')">
                <v-icon v-bind="props" icon="mdi-sort" />
              </v-btn>
            </template>
            <v-card>
              <v-list>
                <div v-for="key of sortKeys" :key="key">
                  <ListItem @click="changeSort(key)">
                    <template #title>{{ $t('sort.' + key) }}</template>
                    <template #append>
                      <v-icon v-if="sortBy == key" icon="mdi-check" />
                    </template>
                  </ListItem>
                  <v-divider />
                </div>
              </v-list>
            </v-card>
          </v-menu>

          <!-- toggle search button -->
          <v-btn
            v-if="showSearchButton != undefined ? showSearchButton : getBreakpointValue('bp1') || !title"
            v-bind="props"
            icon
            variant="plain"
            :title="$t('tooltip.search')"
            @click="toggleSearch()"
          >
            <v-icon icon="mdi-magnify" />
          </v-btn>

          <!-- toggle view mode button -->
          <v-btn
            v-bind="props"
            :icon="viewMode == 'panel' ? 'mdi-view-list' : 'mdi-grid'"
            variant="plain"
            :title="$t('tooltip.toggle_view_mode')"
            @click="toggleViewMode()"
          />

          <!-- provider filter dropdown -->
          <v-menu
            v-if="providerFilter && providerFilter.length > 1"
            location="bottom end"
            :close-on-content-click="true"
          >
            <template #activator="{ props }">
              <v-btn icon v-bind="props" variant="plain">
                <ProviderIcon :domain="activeProviderFilter" :size="30" />
              </v-btn>
            </template>
            <v-card>
              <v-list>
                <div v-for="provId of providerFilter" :key="provId">
                  <ListItem @click="changeActiveProviderFilter(provId)">
                    <template #prepend><ProviderIcon :domain="provId" :size="30" /></template>
                    <template #title>
                      <span v-if="provId == 'library'">{{ $t('library') }}</span>
                      <span v-else>{{ api.getProviderName(provId) }}</span>
                    </template>
                    <template #append>
                      <v-icon v-if="activeProviderFilter == provId" icon="mdi-check" />
                    </template>
                  </ListItem>
                  <v-divider />
                </div>
              </v-list>
            </v-card>
          </v-menu>
        </template>
      </v-toolbar>
      <v-divider />

      <v-text-field
        v-if="showSearch"
        id="searchInput"
        v-model="search"
        clearable
        prepend-inner-icon="mdi-magnify"
        :label="$t('search')"
        hide-details
        variant="filled"
        style="width: auto; margin-left: 15px; margin-right: 15px; margin-top: 10px"
        @focus="searchHasFocus = true"
        @blur="searchHasFocus = false"
      />

      <Container>
        <!-- loading animation -->
        <v-progress-linear v-if="loading" indeterminate />

        <!-- panel view -->
        <v-row v-if="viewMode == 'panel'">
          <v-col
            v-for="item in allItems"
            :key="item.uri"
            :class="`col-${panelViewItemResponsive($vuetify.display.width)}`"
          >
            <PanelviewItem
              :item="item"
              :is-selected="isSelected(item)"
              :show-checkboxes="showCheckboxes"
              :show-track-number="showTrackNumber"
              @select="onSelect"
              @menu="onMenu"
              @click="onClick"
            />
          </v-col>
        </v-row>

        <!-- list view -->
        <div v-if="viewMode == 'list'">
          <RecycleScroller v-slot="{ item }" :items="allItems" :item-size="70" key-field="uri" page-mode>
            <ListviewItem
              :key="item.uri"
              :item="item"
              :show-track-number="showTrackNumber"
              :show-disc-number="showTrackNumber"
              :show-duration="showDuration"
              :show-favorite="showFavoritesOnlyFilter"
              :show-menu="showMenu"
              :show-provider="showProvider"
              :show-album="showAlbum"
              :show-checkboxes="showCheckboxes"
              :is-selected="isSelected(item)"
              :show-details="itemtype.includes('versions')"
              :parent-item="parentItem"
              @select="onSelect"
              @menu="onMenu"
              @click="onClick"
            />
          </RecycleScroller>
        </div>

        <!-- inifinite scroll component -->
        <InfiniteLoading @infinite="loadNextPage" />

        <!-- show alert if no item found -->
        <div v-if="!loading && allItems.length == 0">
          <Alert v-if="!loading && allItems.length == 0 && (search || favoritesOnly)" :title="$t('no_content_filter')">
            <v-btn v-if="search" style="margin-top: 15px" @click="redirectSearch">
              {{ $t('try_global_search') }}
            </v-btn>
          </Alert>
          <Alert v-else-if="!loading && allItems.length == 0">
            {{ $t('no_content') }}
          </Alert>
        </div>
        <v-snackbar :model-value="selectedItems.length > 1" :timeout="-1" style="margin-bottom: 120px">
          <span>{{ $t('items_selected', [selectedItems.length]) }}</span>
          <template #actions>
            <v-btn color="primary" variant="text" @click="showContextMenu = true">
              {{ $t('actions') }}
            </v-btn>
          </template>
        </v-snackbar>
      </Container>
    </v-card>
  </section>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-unused-vars,vue/no-setup-props-destructure */

import { ref, onBeforeUnmount, nextTick, onMounted, watch } from 'vue';
import { type Album, type MediaItemType, type PagedItems, type Track } from '../plugins/api/interfaces';
import { RecycleScroller } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import { store } from '../plugins/store';
import ListviewItem from './ListviewItem.vue';
import PanelviewItem from './PanelviewItem.vue';
import MediaItemContextMenu, { itemIsAvailable } from './MediaItemContextMenu.vue';
import { useRouter } from 'vue-router';
import { api } from '../plugins/api';
import InfiniteLoading from 'v3-infinite-loading';
import 'v3-infinite-loading/lib/style.css';
import { getBreakpointValue } from '@/plugins/breakpoint';
import ListItem from '@/components/mods/ListItem.vue';
import ProviderIcon from '@/components/ProviderIcon.vue';
import Alert from './mods/Alert.vue';
import Container from './mods/Container.vue';

// properties
export interface Props {
  itemtype: string;
  sortKeys?: string[];
  showTrackNumber?: boolean;
  showProvider?: boolean;
  showAlbum?: boolean;
  showMenu?: boolean;
  showFavoritesOnlyFilter?: boolean;
  showDuration?: boolean;
  parentItem?: MediaItemType;
  showAlbumArtistsOnlyFilter?: boolean;
  showSearchButton?: boolean;
  showRefreshButton?: boolean;
  showSelectButton?: boolean;
  updateAvailable?: boolean;
  title?: string;
  hideOnEmpty?: boolean;
  providerFilter?: string[];
  loadData: (params: LoadDataParams) => Promise<PagedItems>;
}
const props = withDefaults(defineProps<Props>(), {
  sortKeys: () => ['sort_name', 'timestamp_added DESC'],
  showTrackNumber: true,
  showProvider: Object.keys(api.providers).length > 1,
  showAlbum: true,
  showMenu: true,
  showFavoritesOnlyFilter: true,
  showDuration: true,
  parentItem: undefined,
  hideOnEmpty: false,
  showSearchButton: undefined,
  showRefreshButton: undefined,
  showSelectButton: undefined,
});

const defaultLimit = 100;

// global refs
const router = useRouter();

// local refs
const viewMode = ref('list');
const search = ref('');
const sortBy = ref<string>('sort_name');
const showSortMenu = ref(false);
const showSearch = ref(false);
const searchHasFocus = ref(false);
const offset = ref(0);
const allItems = ref<MediaItemType[]>([]);
const totalItems = ref<number>();
const loading = ref(false);
const favoritesOnly = ref(false);
const selectedItems = ref<MediaItemType[]>([]);
const showContextMenu = ref(false);
const newContentAvailable = ref(false);
const showCheckboxes = ref(false);
const albumArtistsOnlyFilter = ref(true);
const activeProviderFilter = ref<string>('library');

// computed properties

// emitters
const emit = defineEmits<{
  (e: 'refreshClicked'): void;
}>();

// methods
const toggleSearch = function () {
  if (showSearch.value) showSearch.value = false;
  else {
    showSearch.value = true;
    nextTick(() => {
      document.getElementById('searchInput')?.focus();
    });
  }
};

const panelViewItemResponsive = function (displaySize: number) {
  if (getBreakpointValue({ breakpoint: 'bp1', condition: 'lt', offset: store.sizeNavigationMenu })) {
    return 2;
  } else if (
    getBreakpointValue({ breakpoint: 'bp1', condition: 'gt', offset: store.sizeNavigationMenu }) &&
    getBreakpointValue({ breakpoint: 'bp4', condition: 'lt', offset: store.sizeNavigationMenu })
  ) {
    return 3;
  } else if (
    getBreakpointValue({ breakpoint: 'bp4', condition: 'gt', offset: store.sizeNavigationMenu }) &&
    getBreakpointValue({ breakpoint: 'bp6', condition: 'lt', offset: store.sizeNavigationMenu })
  ) {
    return 4;
  } else if (
    getBreakpointValue({ breakpoint: 'bp6', condition: 'gt', offset: store.sizeNavigationMenu }) &&
    getBreakpointValue({ breakpoint: 'bp7', condition: 'lt', offset: store.sizeNavigationMenu })
  ) {
    return 5;
  } else if (
    getBreakpointValue({ breakpoint: 'bp7', condition: 'gt', offset: store.sizeNavigationMenu }) &&
    getBreakpointValue({ breakpoint: 'bp8', condition: 'lt', offset: store.sizeNavigationMenu })
  ) {
    return 6;
  } else if (
    getBreakpointValue({ breakpoint: 'bp8', condition: 'gt', offset: store.sizeNavigationMenu }) &&
    getBreakpointValue({ breakpoint: 'bp9', condition: 'lt', offset: store.sizeNavigationMenu })
  ) {
    return 7;
  } else if (
    getBreakpointValue({ breakpoint: 'bp9', condition: 'gt', offset: store.sizeNavigationMenu }) &&
    getBreakpointValue({ breakpoint: 'bp10', condition: 'lt', offset: store.sizeNavigationMenu })
  ) {
    return 8;
  } else if (getBreakpointValue({ breakpoint: 'bp10', condition: 'gt', offset: store.sizeNavigationMenu })) {
    return 9;
  } else {
    return 0;
  }
};

const toggleViewMode = function () {
  if (viewMode.value === 'panel') viewMode.value = 'list';
  else viewMode.value = 'panel';
  localStorage.setItem(`viewMode.${props.itemtype}`, viewMode.value);
};

const toggleFavoriteFilter = function () {
  favoritesOnly.value = !favoritesOnly.value;
  const favoritesOnlyStr = favoritesOnly.value ? 'true' : 'false';
  localStorage.setItem(`favoriteFilter.${props.itemtype}`, favoritesOnlyStr);
  loadData(true);
};

const toggleAlbumArtistsFilter = function () {
  albumArtistsOnlyFilter.value = !albumArtistsOnlyFilter.value;
  const albumArtistsOnlyStr = albumArtistsOnlyFilter.value ? 'true' : 'false';
  localStorage.setItem(`albumArtistsFilter.${props.itemtype}`, albumArtistsOnlyStr);
  loadData(true);
};

const isSelected = function (item: MediaItemType) {
  return selectedItems.value.includes(item);
};

const onSelect = function (item: MediaItemType, selected: boolean) {
  if (selected) {
    if (!selectedItems.value.includes(item)) selectedItems.value.push(item);
  } else {
    for (let i = 0; i < selectedItems.value.length; i++) {
      if (selectedItems.value[i] === item) {
        selectedItems.value.splice(i, 1);
      }
    }
  }
  store.blockGlobalPlayMenu = selectedItems.value.length > 0;
};

const onClearSelection = function () {
  selectedItems.value = [];
  showCheckboxes.value = false;
  store.blockGlobalPlayMenu = false;
};

const toggleCheckboxes = function () {
  if (selectedItems.value.length > 0) {
    showContextMenu.value = true;
  } else {
    showCheckboxes.value = !showCheckboxes.value;
  }
};

const onDelete = function (item: MediaItemType) {
  loadData(true);
};

const onMenu = function (item: MediaItemType) {
  selectedItems.value = [item];
  showContextMenu.value = true;
};

const onRefreshClicked = function () {
  loadData(true);
  emit('refreshClicked');
};

const onClick = function (mediaItem: MediaItemType) {
  // mediaItem in the list is clicked
  if (!itemIsAvailable(mediaItem)) {
    onMenu(mediaItem);
    return;
  }

  if (['artist', 'album', 'playlist'].includes(mediaItem.media_type) || !store.selectedPlayer?.available) {
    router.push({
      name: mediaItem.media_type,
      params: {
        itemId: mediaItem.item_id,
        provider: mediaItem.provider,
      },
    });
  } else {
    onMenu(mediaItem);
  }
};

const changeSort = function (sort_key?: string, sort_desc?: boolean) {
  if (sort_key !== undefined) {
    sortBy.value = sort_key;
  }
  localStorage.setItem(`sortBy.${props.itemtype}`, sortBy.value);
  loadData(true);
};

const changeActiveProviderFilter = function (provider: string) {
  activeProviderFilter.value = provider;
  loadData(true);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadNextPage = function ($state: any) {
  if (allItems.value.length == 0) {
    $state.loaded();
    return;
  }
  if (totalItems.value !== undefined && offset.value >= totalItems.value) {
    $state.loaded();
    return;
  }
  offset.value += defaultLimit;
  loadData().then(() => {
    $state.loaded();
  });
};

const redirectSearch = function () {
  localStorage.setItem('globalsearch', search.value);
  router.push({ name: 'search', params: { initSearch: search.value } });
};

// watchers
watch(
  () => search.value,
  (newVal) => {
    if (newVal) showSearch.value = true;
    loadData(true);
  },
);
watch(
  () => props.updateAvailable,
  (newVal) => {
    if (newVal && allItems.value.length == 0) loadData(true);
  },
);

const loadData = async function (clear = false, limit = defaultLimit) {
  if (clear) {
    offset.value = 0;
    newContentAvailable.value = false;
  }
  loading.value = true;

  const nextItems = await props.loadData({
    offset: offset.value,
    limit: limit,
    sortBy: sortBy.value,
    search: search.value,
    favoritesOnly: favoritesOnly.value,
    albumArtistsFilter: albumArtistsOnlyFilter.value,
    providerFilter: activeProviderFilter.value,
  });
  if (offset.value) {
    allItems.value.push(...nextItems.items);
  } else {
    allItems.value = nextItems.items;
  }
  totalItems.value = nextItems.total;
  loading.value = false;
  let storKey = `search.${props.itemtype}`;
  if (props.parentItem) storKey += props.parentItem.item_id;
  localStorage.setItem(storKey, search.value);
};

// get/set default settings at load
onMounted(() => {
  // get stored/default viewMode for this itemtype
  const savedViewMode = localStorage.getItem(`viewMode.${props.itemtype}`);
  if (savedViewMode && savedViewMode !== 'null') {
    viewMode.value = savedViewMode;
  } else if (props.itemtype == 'artists') {
    viewMode.value = 'panel';
  } else if (props.itemtype == 'albums') {
    viewMode.value = 'panel';
  } else {
    viewMode.value = 'list';
  }
  // get stored/default sortBy for this itemtype
  const savedSortBy = localStorage.getItem(`sortBy.${props.itemtype}`);
  if (savedSortBy && savedSortBy !== 'null') {
    sortBy.value = savedSortBy;
  } else {
    sortBy.value = props.sortKeys[0];
  }

  // get stored/default favoriteOnlyFilter for this itemtype
  if (props.showFavoritesOnlyFilter !== false) {
    const savedInFavoriteOnlyStr = localStorage.getItem(`favoriteFilter.${props.itemtype}`);
    if (savedInFavoriteOnlyStr && savedInFavoriteOnlyStr == 'true') {
      favoritesOnly.value = true;
    }
  }

  // get stored/default albumArtistsOnlyFilter for this itemtype
  if (props.showAlbumArtistsOnlyFilter !== false) {
    const albumArtistsOnlyStr = localStorage.getItem(`albumArtistsFilter.${props.itemtype}`);
    if (albumArtistsOnlyStr) {
      albumArtistsOnlyFilter.value = albumArtistsOnlyStr == 'true';
    }
  }
  // get stored searchquery
  let storKey = `search.${props.itemtype}`;
  if (props.parentItem) storKey += props.parentItem.item_id;
  const savedSearch = localStorage.getItem(storKey);

  if (savedSearch && savedSearch !== 'null') {
    console.log('savedSearch', savedSearch);
    search.value = savedSearch;
  }
  loadData(true);
});

// lifecycle hooks
const keyListener = function (e: KeyboardEvent) {
  if (showContextMenu.value) return;
  if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    selectedItems.value = allItems.value;
  } else if (!searchHasFocus.value && e.key == 'Backspace') {
    search.value = search.value.slice(0, -1);
  } else if (!searchHasFocus.value && e.key.length == 1) {
    search.value += e.key;
    showSearch.value = true;
  }
};
document.addEventListener('keydown', keyListener);

onBeforeUnmount(() => {
  document.removeEventListener('keydown', keyListener);
});
</script>

<script lang="ts">
export interface LoadDataParams {
  offset: number;
  limit: number;
  sortBy: string;
  search: string;
  favoritesOnly?: boolean;
  albumArtistsFilter?: boolean;
  providerFilter?: string;
}

export const filteredItems = function (
  // In-memory paging for (smaller) item sets that do not have server side paging
  items: MediaItemType[],
  params: LoadDataParams,
) {
  let result = [];

  // search
  if (params.search) {
    const searchStr = params.search.toLowerCase();
    for (const item of items) {
      if (item.name.toLowerCase().includes(searchStr)) {
        result.push(item);
      } else if ('artist' in item && item.artist?.name.toLowerCase().includes(searchStr)) {
        result.push(item);
      } else if ('album' in item && item.album?.name.toLowerCase().includes(searchStr)) {
        result.push(item);
      } else if ('artists' in item && item.artists && item.artists[0].name.toLowerCase().includes(searchStr)) {
        result.push(item);
      }
    }
  } else {
    result = items;
  }
  // sort
  if (params.sortBy == 'sort_name') {
    result.sort((a, b) => (a.sort_name || a.name).localeCompare(b.sort_name || b.name));
  }
  if (params.sortBy == 'sort_album') {
    result.sort((a, b) => (a as Track).album?.name.localeCompare((b as Track).album?.name));
  }
  if (params.sortBy == 'sort_artist') {
    result.sort((a, b) => (a as Track).artists[0].name.localeCompare((b as Track).artists[0].name));
  }
  if (params.sortBy == 'track_number') {
    result.sort((a, b) => ((a as Track).track_number || 0) - ((b as Track).track_number || 0));
    result.sort((a, b) => ((a as Track).disc_number || 0) - ((b as Track).disc_number || 0));
  }
  if (params.sortBy == 'position') {
    result.sort((a, b) => ((a as Track).position || 0) - ((b as Track).position || 0));
  }
  if (params.sortBy == 'position DESC') {
    result.sort((a, b) => ((b as Track).position || 0) - ((a as Track).position || 0));
  }
  if (params.sortBy == 'year') {
    result.sort((a, b) => ((a as Album).year || 0) - ((b as Album).year || 0));
  }
  if (params.sortBy == 'timestamp_added DESC') {
    result.sort((a, b) => (b.timestamp_added || 0) - (a.timestamp_added || 0));
  }

  if (params.sortBy == 'duration') {
    result.sort((a, b) => ((a as Track).duration || 0) - ((b as Track).duration || 0));
  }

  if (params.sortBy == 'provider') {
    result.sort((a, b) => a.provider.localeCompare(b.provider));
  }

  if (params.favoritesOnly) {
    result = result.filter((x) => x.favorite);
  }

  const totalItems = result.length;
  const pagedItems = result.slice(params.offset, params.offset + params.limit);
  return {
    items: pagedItems,
    count: pagedItems.length,
    limit: params.limit,
    offset: params.offset,
    total: totalItems,
  };
};
</script>
