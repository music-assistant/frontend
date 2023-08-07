<!-- eslint-disable vue/no-v-for-template-key-on-child -->
<template>
  <section v-if="!(hideOnEmpty && pagedItems.length == 0)">
    <!-- eslint-disable vue/no-template-shadow -->
    <v-toolbar color="transparent">
      <template #title>
        {{ title }}
        <v-badge v-if="getBreakpointValue('bp11')" color="grey" :content="total" inline />
      </template>

      <template #append>
        <!-- toggle select button -->
        <Button
          v-if="showSelectButton != undefined ? showSelectButton : getBreakpointValue('bp1')"
          v-bind="props"
          variant="list"
          :title="$t('tooltip.select_items')"
          :disabled="!expanded"
          @click="toggleCheckboxes"
          ><v-icon :icon="showCheckboxes ? 'mdi-checkbox-multiple-outline' : 'mdi-checkbox-multiple-blank-outline'"
        /></Button>

        <!-- favorites only filter -->
        <Button
          v-if="showFavoritesOnlyFilter != undefined ? showFavoritesOnlyFilter : getBreakpointValue('bp1')"
          v-bind="props"
          variant="list"
          :title="$t('tooltip.filter_favorites')"
          :disabled="!expanded"
          @click="toggleFavoriteFilter"
        >
          <v-icon :icon="params.favoritesOnly ? 'mdi-heart' : 'mdi-heart-outline'" />
        </Button>

        <!-- album artists only filter -->
        <Button
          v-if="showAlbumArtistsOnlyFilter"
          v-bind="props"
          variant="list"
          :title="$t('tooltip.album_artist_filter')"
          :disabled="!expanded"
          @click="toggleAlbumArtistsFilter"
        >
          <v-icon :icon="params.albumArtistsFilter ? 'mdi-account-music' : 'mdi-account-music-outline'" />
        </Button>

        <!-- refresh button-->
        <Button
          v-if="showRefreshButton != undefined ? showRefreshButton : getBreakpointValue('bp1')"
          v-bind="props"
          variant="list"
          :title="updateAvailable ? $t('tooltip.refresh_new_content') : $t('tooltip.refresh')"
          :disabled="!expanded || loading"
          @click="onRefreshClicked()"
        >
          <v-badge :model-value="updateAvailable" color="error" dot>
            <v-icon icon="mdi-refresh" />
          </v-badge>
        </Button>

        <!-- sort options -->
        <v-menu v-if="sortKeys.length > 1" v-model="showSortMenu" location="bottom end" :close-on-content-click="true">
          <template #activator="{ props }">
            <Button v-bind="props" variant="list" :disabled="!expanded" :title="$t('tooltip.sort_options')">
              <v-icon v-bind="props" icon="mdi-sort" />
            </Button>
          </template>
          <v-card>
            <v-list>
              <div v-for="key of sortKeys" :key="key">
                <ListItem @click="changeSort(key)">
                  <template #title>{{ $t('sort.' + key) }}</template>
                  <template #append>
                    <v-icon v-if="params.sortBy == key" icon="mdi-check" />
                  </template>
                </ListItem>
                <v-divider />
              </div>
            </v-list>
          </v-card>
        </v-menu>

        <!-- toggle search button -->
        <Button
          v-if="showSearchButton != undefined ? showSearchButton : getBreakpointValue('bp1')"
          v-bind="props"
          variant="list"
          :title="$t('tooltip.search')"
          :disabled="!expanded"
          @click="toggleSearch()"
        >
          <v-icon icon="mdi-magnify" />
        </Button>

        <!-- toggle view mode button -->
        <Button
          v-bind="props"
          variant="list"
          :title="$t('tooltip.toggle_view_mode')"
          :disabled="!expanded"
          @click="toggleViewMode()"
          ><v-icon :icon="viewMode == 'panel' ? 'mdi-view-list' : 'mdi-grid'"
        /></Button>

        <!-- provider filter dropdown -->
        <v-menu v-if="providerFilter && providerFilter.length > 1" location="bottom end" :close-on-content-click="true">
          <template #activator="{ props }">
            <Button v-bind="props" variant="list" :disabled="!expanded">
              <ProviderIcon :domain="params.providerFilter!" :size="30" />
            </Button>
          </template>
          <v-card>
            <v-list>
              <div v-for="provId of providerFilter" :key="provId">
                <ListItem @click="changeActiveProviderFilter(provId)">
                  <template #prepend>
                    <ProviderIcon :domain="provId" :size="30" />
                  </template>
                  <template #title>
                    <span v-if="provId == 'library'">{{ $t('library') }}</span>
                    <span v-else>{{ api.getProviderName(provId) }}</span>
                  </template>
                  <template #append>
                    <v-icon v-if="params.providerFilter == provId" icon="mdi-check" />
                  </template>
                </ListItem>
                <v-divider />
              </div>
            </v-list>
          </v-card>
        </v-menu>

        <!-- contextmenu -->
        <v-menu v-if="contextMenuItems && contextMenuItems.length > 0" location="bottom end">
          <template #activator="{ props }">
            <Button variant="list" style="right: 3px" v-bind="props">
              <v-icon icon="mdi-dots-vertical" />
            </Button>
          </template>
          <v-list>
            <ListItem
              v-for="(item, index) in contextMenuItems.filter((x) => x.hide != true)"
              :key="index"
              :title="$t(item.label, item.labelArgs)"
              :disabled="item.disabled == true"
              @click="item.action ? item.action() : ''"
            >
              <template #prepend>
                <v-avatar :icon="item.icon" />
              </template>
            </ListItem>
          </v-list>
        </v-menu>

        <!-- expand/collapse button -->
        <Button v-if="allowCollapse" variant="list" :title="$t('tooltip.collapse_expand')" @click="toggleExpand"
          ><v-icon :icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'"
        /></Button>
      </template>
    </v-toolbar>
    <v-divider />

    <v-text-field
      v-if="showSearch && expanded"
      id="searchInput"
      v-model="params.search"
      clearable
      prepend-inner-icon="mdi-magnify"
      :label="$t('search')"
      hide-details
      variant="filled"
      style="width: auto; margin-top: 10px"
      @focus="searchHasFocus = true"
      @blur="searchHasFocus = false"
    />
    <Container v-if="expanded" :variant="viewMode == 'panel' ? 'panel' : 'default'">
      <!-- loading animation -->
      <v-progress-linear v-if="loading" indeterminate />

      <!-- panel view -->
      <v-row v-if="viewMode == 'panel'">
        <v-col
          v-for="item in pagedItems"
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
      <v-virtual-scroll v-if="viewMode == 'list'" :height="70" :items="pagedItems" style="height: 100%">
        <template #default="{ item }">
          <ListviewItem
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
            :context-menu-items="showMenu ? getContextMenuItems([item], parentItem) : []"
            @select="onSelect"
            @menu="onMenu"
            @click="onClick"
          />
        </template>
      </v-virtual-scroll>

      <!-- inifinite scroll component -->
      <InfiniteLoading v-if="infiniteScroll" @infinite="loadNextPage" />
      <v-btn v-else-if="(total || 0) > pagedItems.length" variant="plain" @click="loadNextPage()">{{
        $t('load_more_items')
      }}</v-btn>

      <!-- show alert if no item found -->
      <div v-if="!loading && pagedItems.length == 0">
        <Alert
          v-if="!loading && pagedItems.length == 0 && (params.search || params.favoritesOnly)"
          :title="$t('no_content_filter')"
        >
          <v-btn v-if="params.search" style="margin-top: 15px" @click="redirectSearch">
            {{ $t('try_global_search') }}
          </v-btn>
        </Alert>
        <Alert v-else-if="!loading && pagedItems.length == 0">
          {{ $t('no_content') }}
        </Alert>
      </div>

      <!-- box shown when item(s) selected -->
      <v-snackbar :model-value="selectedItems.length > 1" :timeout="-1" style="margin-bottom: 120px">
        <span>{{ $t('items_selected', [selectedItems.length]) }}</span>
        <template #actions>
          <v-btn color="primary" variant="text" @click="showPlayMenu(true)">
            {{ $t('actions') }}
          </v-btn>
        </template>
      </v-snackbar>
    </Container>
  </section>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-unused-vars,vue/no-setup-props-destructure */

import { ref, onBeforeUnmount, nextTick, onMounted, watch } from 'vue';
import {
  MediaType,
  type Album,
  type MediaItemType,
  type PagedItems,
  type Track,
  BrowseFolder,
  ItemMapping,
} from '../plugins/api/interfaces';
import { store } from '../plugins/store';
import ListviewItem from './ListviewItem.vue';
import Button from './mods/Button.vue';
import PanelviewItem from './PanelviewItem.vue';
import { itemIsAvailable, getContextMenuItems, ContextMenuItem } from '@/helpers/contextmenu';
import { useRouter } from 'vue-router';
import { api } from '../plugins/api';
import InfiniteLoading from 'v3-infinite-loading';
import 'v3-infinite-loading/lib/style.css';
import { getBreakpointValue } from '@/plugins/breakpoint';
import ListItem from '@/components/mods/ListItem.vue';
import ProviderIcon from '@/components/ProviderIcon.vue';
import Alert from './mods/Alert.vue';
import Container from './mods/Container.vue';
import { eventbus } from '@/plugins/eventbus';
import { useI18n } from 'vue-i18n';
import { getElement } from '@egjs/vue3-flicking';

export interface LoadDataParams {
  offset: number;
  limit: number;
  sortBy: string;
  search: string;
  favoritesOnly?: boolean;
  albumArtistsFilter?: boolean;
  providerFilter?: string;
  refresh?: boolean;
}
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
  allowCollapse?: boolean;
  allowKeyHooks?: boolean;
  contextMenuItems?: Array<ContextMenuItem>;
  // loadPagedData callback is provided for serverside paging/sorting
  loadPagedData?: (params: LoadDataParams) => Promise<PagedItems>;
  // loadItems callback is provided for flat non-paged listings
  loadItems?: (params: LoadDataParams) => Promise<MediaItemType[]>;
  limit?: number;
  infiniteScroll?: boolean;
  path?: string;
}
const props = withDefaults(defineProps<Props>(), {
  sortKeys: () => ['name'],
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
  allowCollapse: false,
  allowKeyHooks: false,
  limit: 100,
  infiniteScroll: true,
});

// global refs
const router = useRouter();

// local refs
const params = ref<LoadDataParams>({
  offset: 0,
  limit: 100,
  sortBy: 'name',
  search: '',
  providerFilter: 'library',
});
const viewMode = ref('list');
const showSortMenu = ref(false);
const showSearch = ref(false);
const searchHasFocus = ref(false);
const pagedItems = ref<MediaItemType[]>([]);
const allItems = ref<MediaItemType[]>([]);
const total = ref<number>();
const loading = ref(false);
const selectedItems = ref<MediaItemType[]>([]);
const newContentAvailable = ref(false);
const showCheckboxes = ref(false);
const expanded = ref(true);

const { t } = useI18n();

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
  if (getBreakpointValue({ breakpoint: 'bp1', condition: 'lt', offset: store.navigationMenuSize })) {
    return 2;
  } else if (
    getBreakpointValue({ breakpoint: 'bp1', condition: 'gt', offset: store.navigationMenuSize }) &&
    getBreakpointValue({ breakpoint: 'bp4', condition: 'lt', offset: store.navigationMenuSize })
  ) {
    return 3;
  } else if (
    getBreakpointValue({ breakpoint: 'bp4', condition: 'gt', offset: store.navigationMenuSize }) &&
    getBreakpointValue({ breakpoint: 'bp6', condition: 'lt', offset: store.navigationMenuSize })
  ) {
    return 4;
  } else if (
    getBreakpointValue({ breakpoint: 'bp6', condition: 'gt', offset: store.navigationMenuSize }) &&
    getBreakpointValue({ breakpoint: 'bp7', condition: 'lt', offset: store.navigationMenuSize })
  ) {
    return 5;
  } else if (
    getBreakpointValue({ breakpoint: 'bp7', condition: 'gt', offset: store.navigationMenuSize }) &&
    getBreakpointValue({ breakpoint: 'bp8', condition: 'lt', offset: store.navigationMenuSize })
  ) {
    return 6;
  } else if (
    getBreakpointValue({ breakpoint: 'bp8', condition: 'gt', offset: store.navigationMenuSize }) &&
    getBreakpointValue({ breakpoint: 'bp9', condition: 'lt', offset: store.navigationMenuSize })
  ) {
    return 7;
  } else if (
    getBreakpointValue({ breakpoint: 'bp9', condition: 'gt', offset: store.navigationMenuSize }) &&
    getBreakpointValue({ breakpoint: 'bp10', condition: 'lt', offset: store.navigationMenuSize })
  ) {
    return 8;
  } else if (getBreakpointValue({ breakpoint: 'bp10', condition: 'gt', offset: store.navigationMenuSize })) {
    return 9;
  } else {
    return 0;
  }
};

const toggleExpand = function () {
  expanded.value = !expanded.value;
  localStorage.setItem(`expand.${props.itemtype}`, expanded.value.toString());
};

const toggleViewMode = function () {
  if (viewMode.value === 'panel') viewMode.value = 'list';
  else viewMode.value = 'panel';
  localStorage.setItem(`viewMode.${props.itemtype}`, viewMode.value);
};

const toggleFavoriteFilter = function () {
  params.value.favoritesOnly = !params.value.favoritesOnly;
  const favoritesOnlyStr = params.value.favoritesOnly ? 'true' : 'false';
  localStorage.setItem(`favoriteFilter.${props.itemtype}`, favoritesOnlyStr);
  loadData(true);
};

const toggleAlbumArtistsFilter = function () {
  params.value.albumArtistsFilter = !params.value.albumArtistsFilter;
  const albumArtistsOnlyStr = params.value.albumArtistsFilter ? 'true' : 'false';
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
};

const toggleCheckboxes = function () {
  if (showCheckboxes.value) {
    // clear selection
    selectedItems.value = [];
  }
  showCheckboxes.value = !showCheckboxes.value;
};

const onMenu = function (item: MediaItemType, showContextMenuItems = true) {
  selectedItems.value = [item];
  showPlayMenu(showContextMenuItems);
};

const showPlayMenu = function (showContextMenuItems = true) {
  eventbus.emit('playdialog', {
    items: selectedItems.value,
    parentItem: props.parentItem,
    showContextMenuItems: showContextMenuItems,
  });
};

const onRefreshClicked = function () {
  emit('refreshClicked');
  loadData(true, undefined, true);
};

const onClick = function (mediaItem: MediaItemType) {
  // mediaItem in the list is clicked
  if (!itemIsAvailable(mediaItem)) {
    onMenu(mediaItem, false);
    return;
  }
  if (mediaItem.media_type == MediaType.FOLDER) {
    router.push({
      name: 'browse',
      query: {
        path: (mediaItem as BrowseFolder).path,
      },
    });
  } else if (['artist', 'album', 'playlist'].includes(mediaItem.media_type) || !store.selectedPlayer?.available) {
    router.push({
      name: mediaItem.media_type,
      params: {
        itemId: mediaItem.item_id,
        provider: mediaItem.provider,
      },
    });
  } else {
    onMenu(mediaItem, true);
  }
};

const changeSort = function (sort_key?: string, sort_desc?: boolean) {
  if (sort_key !== undefined) {
    params.value.sortBy = sort_key;
  }
  localStorage.setItem(`sortBy.${props.itemtype}`, params.value.sortBy);
  loadData(true, undefined, sort_key == 'original');
};

const changeActiveProviderFilter = function (provider: string) {
  params.value.providerFilter = provider;
  loadData(true);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadNextPage = function ($state?: any) {
  if (pagedItems.value.length == 0) {
    if ($state) $state.loaded();
    return;
  }
  if (total.value !== undefined && params.value.offset >= total.value) {
    if ($state) $state.loaded();
    return;
  }
  params.value.offset += props.limit;
  loadData().then(() => {
    if ($state) $state.loaded();
  });
};

const redirectSearch = function () {
  localStorage.setItem('globalsearch', params.value.search);
  router.push({ name: 'search', params: { initSearch: params.value.search } });
};

// watchers
watch(
  () => params.value.search,
  (newVal) => {
    if (newVal) showSearch.value = true;
    loadData(true);
    let storKey = `search.${props.itemtype}`;
    if (props.parentItem) storKey += props.parentItem.item_id;
    localStorage.setItem(storKey, params.value.search);
  },
);
watch(
  () => props.path,
  () => {
    allItems.value = [];
    restoreState();
  },
);
watch(
  () => props.limit,
  (newVal) => {
    params.value.limit = newVal;
  },
);

const loadData = async function (clear = false, limit = props.limit, refresh = false) {
  if (clear || refresh) {
    params.value.offset = 0;
    newContentAvailable.value = false;
  }
  loading.value = true;
  params.value.limit = props.limit;
  if (props.loadPagedData !== undefined) {
    // call server for paged listing
    const nextItems = await props.loadPagedData(params.value);
    if (nextItems) {
      if (params.value.offset) {
        pagedItems.value.push(...nextItems.items);
      } else {
        pagedItems.value = nextItems.items;
      }
      total.value = nextItems.total;
    }
  } else if (props.loadItems !== undefined) {
    // grab items from loadItems callback
    if (allItems.value.length === 0 || refresh) {
      // load all items from the callback
      allItems.value = [];
      (allItems.value = await props.loadItems(params.value)), params.value;
      total.value = allItems.value.length;
    }
    // filter
    const nextItems = getFilteredItems(allItems.value, params.value);
    if (params.value.offset) {
      pagedItems.value.push(...nextItems);
    } else {
      pagedItems.value = nextItems;
    }
  }
  loading.value = false;
};

const getSortName = function (item: MediaItemType | ItemMapping) {
  if ('label' in item && item.label && item.name) return t(item.label, [item.name]);
  if ('label' in item && item.label) return t(item.label);
  if ('sort_name' in item && item.sort_name) return item.sort_name;
  return item.name;
};

const getFilteredItems = function (
  // In-memory filter for (smaller) item sets that do not have server side paging and filtering
  items: MediaItemType[],
  params: LoadDataParams,
): MediaItemType[] {
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
  if (params.sortBy == 'name') {
    result.sort((a, b) => getSortName(a).localeCompare(getSortName(b)));
  }
  if (params.sortBy == 'name_desc') {
    result.sort((a, b) => getSortName(b).localeCompare(getSortName(a)));
  }
  if (params.sortBy == 'album') {
    result.sort((a, b) => (a as Track).album?.sort_name.localeCompare((b as Track).album?.sort_name));
  }
  if (params.sortBy == 'artist') {
    result.sort((a, b) => (a as Track).artists[0].name.localeCompare((b as Track).artists[0].name));
  }
  if (params.sortBy == 'track_number') {
    result.sort((a, b) => ((a as Track).track_number || 0) - ((b as Track).track_number || 0));
    result.sort((a, b) => ((a as Track).disc_number || 0) - ((b as Track).disc_number || 0));
  }
  if (params.sortBy == 'position') {
    result.sort((a, b) => ((a as Track).position || 0) - ((b as Track).position || 0));
  }
  if (params.sortBy == 'position_desc') {
    result.sort((a, b) => ((b as Track).position || 0) - ((a as Track).position || 0));
  }
  if (params.sortBy == 'year') {
    result.sort((a, b) => ((a as Album).year || 0) - ((b as Album).year || 0));
  }
  if (params.sortBy == 'recent') {
    result.sort((a, b) => (b.timestamp_added || 0) - (a.timestamp_added || 0));
  }

  if (params.sortBy == 'duration') {
    result.sort((a, b) => ((a as Track).duration || 0) - ((b as Track).duration || 0));
  }
  if (params.sortBy == 'duration_desc') {
    result.sort((a, b) => ((b as Track).duration || 0) - ((a as Track).duration || 0));
  }

  if (params.sortBy == 'provider') {
    result.sort((a, b) => a.provider.localeCompare(b.provider));
  }

  if (params.favoritesOnly) {
    result = result.filter((x) => x.favorite);
  }
  return result.slice(params.offset, params.offset + params.limit);
};

const restoreState = function () {
  // restore state for this path/itemtype
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
  if (savedSortBy && savedSortBy !== 'null' && props.sortKeys.includes(savedSortBy)) {
    params.value.sortBy = savedSortBy;
  } else {
    params.value.sortBy = props.sortKeys[0];
  }

  // get stored/default favoriteOnlyFilter for this itemtype
  if (props.showFavoritesOnlyFilter !== false) {
    const savedInFavoriteOnlyStr = localStorage.getItem(`favoriteFilter.${props.itemtype}`);
    if (savedInFavoriteOnlyStr && savedInFavoriteOnlyStr == 'true') {
      params.value.favoritesOnly = true;
    }
  }

  // get stored/default albumArtistsOnlyFilter for this itemtype
  if (props.showAlbumArtistsOnlyFilter !== false) {
    const albumArtistsOnlyStr = localStorage.getItem(`albumArtistsFilter.${props.itemtype}`);
    if (albumArtistsOnlyStr) {
      params.value.albumArtistsFilter = albumArtistsOnlyStr == 'true';
    }
  }

  // get stored/default expand property for this itemtype
  if (props.allowCollapse !== false) {
    const expandStr = localStorage.getItem(`expand.${props.itemtype}`);
    if (expandStr) {
      expanded.value = expandStr == 'true';
    }
  }

  // get stored searchquery
  let storKey = `search.${props.itemtype}`;
  if (props.parentItem) storKey += props.parentItem.item_id;
  const savedSearch = localStorage.getItem(storKey);

  if (savedSearch && savedSearch !== 'null') {
    params.value.search = savedSearch;
  }
  loadData(true);
};

// get/set default settings at load
onMounted(async () => {
  restoreState();
});

// lifecycle hooks
const keyListener = function (e: KeyboardEvent) {
  if (store.dialogActive) return;
  if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    // CTRL-A (select all requested)
    // fetch all items first
    while (pagedItems.value.length < total.value!) {
      if (total.value !== undefined && params.value.offset >= total.value) {
        break;
      }
      params.value.offset += props.limit;
      loadData();
    }
    selectedItems.value = pagedItems.value;
    showCheckboxes.value = true;
  } else if (!searchHasFocus.value && e.key == 'Backspace') {
    params.value.search = params.value.search.slice(0, -1);
  } else if (!searchHasFocus.value && e.key.length == 1) {
    params.value.search += e.key;
    showSearch.value = true;
  }
};

if (props.allowKeyHooks) {
  document.addEventListener('keydown', keyListener);
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', keyListener);
  });
}
</script>

<style>
.v-toolbar > .v-toolbar__content > .v-toolbar__append {
  margin-right: 5px;
}
</style>
