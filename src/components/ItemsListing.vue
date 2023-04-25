<!-- eslint-disable vue/no-v-for-template-key-on-child -->
<template>
  <section>
    <!-- eslint-disable vue/no-template-shadow -->
    <v-toolbar density="compact" variant="flat" color="transparent">
      <v-tooltip location="bottom">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            :icon="selectedItems.length > 0 ? 'mdi-checkbox-multiple-outline' : 'mdi-checkbox-multiple-blank-outline'"
            variant="plain"
            @click="toggleCheckboxes"
          />
          <span v-if="!$vuetify.display.mobile">
            <span v-if="!selectedItems.length && totalItems" style="cursor: pointer" @click="toggleCheckboxes">{{
              $t('items_total', [totalItems])
            }}</span>
            <span v-else-if="selectedItems.length" style="cursor: pointer" @click="toggleCheckboxes">{{
              $t('items_selected', [selectedItems.length])
            }}</span>
          </span>
        </template>
        <span>{{ $t('tooltip.select_items') }}</span>
      </v-tooltip>

      <v-spacer />

      <v-tooltip location="bottom" close-on-content-click>
        <template #activator="{ props }">
          <v-btn v-if="showLibrary !== false" v-bind="props" icon variant="plain" @click="toggleLibraryFilter">
            <v-icon :icon="inLibraryOnly ? 'mdi-heart' : 'mdi-heart-outline'" />
          </v-btn>
        </template>
        <span>{{ $t('tooltip.filter_library') }}</span>
      </v-tooltip>

      <v-tooltip v-if="showAlbumArtistsOnlyFilter" location="bottom">
        <template #activator="{ props }">
          <v-btn v-bind="props" icon variant="plain" @click="toggleAlbumArtistsFilter">
            <v-icon :icon="albumArtistsOnlyFilter ? 'mdi-account-music' : 'mdi-account-music-outline'" />
          </v-btn>
        </template>
        <span>{{ $t('tooltip.album_artist_filter') }}</span>
      </v-tooltip>

      <v-tooltip location="bottom">
        <template #activator="{ props }">
          <v-btn v-bind="props" icon variant="plain" @click="onRefreshClicked()">
            <v-badge :model-value="updateAvailable" color="error" dot>
              <v-icon icon="mdi-refresh" />
            </v-badge>
          </v-btn>
        </template>
        <span v-if="updateAvailable">{{ $t('tooltip.refresh_new_content') }}</span>
        <span v-else>{{ $t('tooltip.refresh') }}</span>
      </v-tooltip>

      <v-menu v-if="sortKeys.length > 1" v-model="showSortMenu" location="bottom end" :close-on-content-click="true">
        <template #activator="{ props: menu }">
          <v-tooltip location="bottom">
            <template #activator="{ props: tooltip }">
              <v-btn icon v-bind="props" variant="plain">
                <v-icon v-bind="mergeProps(menu, tooltip)" icon="mdi-sort" />
              </v-btn>
            </template>
            <span>{{ $t('tooltip.sort_options') }}</span>
          </v-tooltip>
        </template>
        <v-card>
          <v-list>
            <div v-for="key of sortKeys" :key="key">
              <v-list-item @click="changeSort(key)">
                <v-list-item-title>{{ $t('sort.' + key) }}</v-list-item-title>
                <template #append>
                  <v-icon v-if="sortBy == key" icon="mdi-check" />
                </template>
              </v-list-item>
              <v-divider />
            </div>
          </v-list>
        </v-card>
      </v-menu>

      <v-tooltip location="bottom">
        <template #activator="{ props }">
          <v-btn v-bind="props" icon variant="plain" @click="toggleSearch()">
            <v-icon icon="mdi-magnify" />
          </v-btn>
        </template>
        <span>{{ $t('tooltip.search') }}</span>
      </v-tooltip>

      <v-tooltip location="bottom">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            :icon="viewMode == 'panel' ? 'mdi-view-list' : 'mdi-grid'"
            variant="plain"
            @click="toggleViewMode()"
          />
        </template>
        <span>{{ $t('tooltip.toggle_view_mode') }}</span>
      </v-tooltip>
    </v-toolbar>
    <MediaItemContextMenu
      v-model="showContextMenu"
      :items="selectedItems"
      :parent-item="parentItem"
      @clear="onClearSelection"
      @delete="onDelete"
    />
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

    <div style="margin-left: 15px; margin-right: 15px; margin-top: 20px; margin-bottom: 20px; padding: 0">
      <!-- loading animation -->
      <v-progress-linear v-if="loading" indeterminate />

      <!-- panel view -->
      <v-row v-if="viewMode == 'panel'">
        <v-col v-for="item in items" :key="item.uri" :class="`col-${panelViewItemResponsive($vuetify.display.width)}`">
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
        <RecycleScroller v-slot="{ item }" :items="items" :item-size="60" key-field="uri" page-mode>
          <ListviewItem
            :key="item.uri"
            :item="item"
            :show-track-number="showTrackNumber"
            :show-duration="showDuration"
            :show-library="showLibrary !== false && !inLibraryOnly"
            :show-menu="showMenu"
            :show-providers="showProviders"
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

      <!-- show alert if no items found -->
      <div v-if="!loading && items.length == 0">
        <v-alert
          v-if="!loading && items.length == 0 && (search || inLibraryOnly)"
          density="compact"
          variant="outlined"
          :title="$t('no_content_filter')"
        >
          <v-btn v-if="search" style="margin-top: 15px" @click="redirectSearch">
            {{ $t('try_global_search') }}
          </v-btn>
        </v-alert>
        <v-alert v-else-if="!loading && items.length == 0" density="compact" variant="outlined">
          {{ $t('no_content') }}
        </v-alert>
      </div>
      <v-snackbar :model-value="selectedItems.length > 1" :timeout="-1" style="margin-bottom: 120px">
        <span>{{ $t('items_selected', [selectedItems.length]) }}</span>
        <template #actions>
          <v-btn color="primary" variant="text" @click="showContextMenu = true">
            {{ $t('actions') }}
          </v-btn>
        </template>
      </v-snackbar>
    </div>
  </section>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-unused-vars,vue/no-setup-props-destructure */

import { ref, onBeforeUnmount, nextTick, onMounted, watch, mergeProps } from 'vue';
import {
  EventType,
  type Album,
  type EventMessage,
  type MediaItemType,
  type PagedItems,
  type Track,
} from '../plugins/api/interfaces';
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
import { getResponsiveBreakpoints } from '@/utils';

// properties
export interface Props {
  itemtype: string;
  sortKeys?: string[];
  showTrackNumber?: boolean;
  showProviders?: boolean;
  showAlbum?: boolean;
  showMenu?: boolean;
  showLibrary?: boolean;
  showDuration?: boolean;
  parentItem?: MediaItemType;
  showAlbumArtistsOnlyFilter?: boolean;
  updateAvailable?: boolean;
  loadData: (offset: number, limit: number, sort: string, search: string, library?: boolean) => Promise<PagedItems>;
}
const props = withDefaults(defineProps<Props>(), {
  sortKeys: () => ['sort_name', 'timestamp_added DESC'],
  showTrackNumber: true,
  showProviders: Object.keys(api.providers).length > 1,
  showAlbum: true,
  showMenu: true,
  showLibrary: true,
  showDuration: true,
  parentItem: undefined,
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
const items = ref<MediaItemType[]>([]);
const totalItems = ref<number>();
const loading = ref(false);
const inLibraryOnly = ref(false);
const selectedItems = ref<MediaItemType[]>([]);
const showContextMenu = ref(false);
const newContentAvailable = ref(false);
const showCheckboxes = ref(false);
const albumArtistsOnlyFilter = ref(false);

// computed properties

// emitters
const emit = defineEmits<{
  (e: 'toggleAlbumArtistsOnly', value: boolean): void;
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
  if (displaySize < getResponsiveBreakpoints.breakpoint_0) {
    return 2;
  } else if (
    displaySize >= getResponsiveBreakpoints.breakpoint_0 &&
    displaySize < getResponsiveBreakpoints.breakpoint_2
  ) {
    return 3;
  } else if (
    displaySize >= getResponsiveBreakpoints.breakpoint_2 &&
    displaySize < getResponsiveBreakpoints.breakpoint_3
  ) {
    return 4;
  } else if (
    displaySize >= getResponsiveBreakpoints.breakpoint_3 &&
    displaySize < getResponsiveBreakpoints.breakpoint_4
  ) {
    return 5;
  } else if (
    displaySize >= getResponsiveBreakpoints.breakpoint_4 &&
    displaySize < getResponsiveBreakpoints.breakpoint_5
  ) {
    return 6;
  } else if (
    displaySize >= getResponsiveBreakpoints.breakpoint_5 &&
    displaySize < getResponsiveBreakpoints.breakpoint_6
  ) {
    return 7;
  } else if (
    displaySize >= getResponsiveBreakpoints.breakpoint_6 &&
    displaySize < getResponsiveBreakpoints.breakpoint_9
  ) {
    return 8;
  } else if (displaySize >= getResponsiveBreakpoints.breakpoint_9) {
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

const toggleLibraryFilter = function () {
  inLibraryOnly.value = !inLibraryOnly.value;
  const inLibraryOnlyStr = inLibraryOnly.value ? 'true' : 'false';
  localStorage.setItem(`libraryFilter.${props.itemtype}`, inLibraryOnlyStr);
  loadData(true);
};

const toggleAlbumArtistsFilter = function () {
  albumArtistsOnlyFilter.value = !albumArtistsOnlyFilter.value;
  const albumArtistsOnlyStr = albumArtistsOnlyFilter.value ? 'true' : 'false';
  localStorage.setItem(`albumArtistsFilter.${props.itemtype}`, albumArtistsOnlyStr);
  emit('toggleAlbumArtistsOnly', albumArtistsOnlyFilter.value);
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
  const forceProviderVersion = props.itemtype.includes('versions').toString();

  if (
    ['artist', 'album', 'playlist'].includes(mediaItem.media_type) ||
    forceProviderVersion == 'true' ||
    !store.selectedPlayer?.available
  ) {
    router.push({
      name: mediaItem.media_type,
      params: {
        itemId: mediaItem.item_id,
        provider: mediaItem.provider,
        forceProviderVersion,
      },
    });
  } else if (store.selectedPlayer) {
    // assume track (or radio) item
    api.playMedia(mediaItem);
  }
};

const changeSort = function (sort_key?: string, sort_desc?: boolean) {
  if (sort_key !== undefined) {
    sortBy.value = sort_key;
  }
  localStorage.setItem(`sortBy.${props.itemtype}`, sortBy.value);
  loadData(true);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadNextPage = function ($state: any) {
  if (items.value.length == 0) {
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
    if (newVal && items.value.length == 0) loadData(true);
  },
);

const loadData = async function (clear = false, limit = defaultLimit) {
  if (clear) {
    offset.value = 0;
    newContentAvailable.value = false;
  }
  loading.value = true;

  const nextItems = await props.loadData(offset.value, limit, sortBy.value, search.value || '', inLibraryOnly.value);
  if (offset.value) {
    items.value.push(...nextItems.items);
  } else {
    items.value = nextItems.items;
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

  // get stored/default libraryOnlyFilter for this itemtype
  if (props.showLibrary !== false) {
    const savedInLibraryOnlyStr = localStorage.getItem(`libraryFilter.${props.itemtype}`);
    if (savedInLibraryOnlyStr && savedInLibraryOnlyStr == 'true') {
      inLibraryOnly.value = true;
    }
  }

  // get stored/default albumArtistsOnlyFilter for this itemtype
  if (props.showAlbumArtistsOnlyFilter !== false) {
    const albumArtistsOnlyStr = localStorage.getItem(`albumArtistsFilter.${props.itemtype}`);
    if (albumArtistsOnlyStr && albumArtistsOnlyStr == 'true') {
      albumArtistsOnlyFilter.value = true;
      emit('toggleAlbumArtistsOnly', albumArtistsOnlyFilter.value);
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

onMounted(() => {
  //reload if/when parent item updates
  const unsub = api.subscribe_multi(
    [EventType.MEDIA_ITEM_ADDED, EventType.MEDIA_ITEM_UPDATED, EventType.MEDIA_ITEM_DELETED],
    (evt: EventMessage) => {
      if (evt.event == EventType.MEDIA_ITEM_DELETED) {
        items.value = items.value.filter((x) => x.uri != evt.object_id);
      } else if (evt.event == EventType.MEDIA_ITEM_UPDATED) {
        // update listing if relevant item changes
        const updatedItem = evt.data as MediaItemType;
        items.value = items.value.map((x) => (x.uri == updatedItem.uri ? updatedItem : x));
      }
    },
  );
  onBeforeUnmount(unsub);
});

// lifecycle hooks
const keyListener = function (e: KeyboardEvent) {
  if (showContextMenu.value) return;
  if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    selectedItems.value = items.value;
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
export const filteredItems = function (
  // In-memory paging for (smaller) item sets that do not have server side paging
  items: MediaItemType[],
  offset: number,
  limit: number,
  sortBy: string,
  search?: string,
  inLibraryOnly = true,
) {
  let result = [];

  // search
  if (search) {
    const searchStr = search.toLowerCase();
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
  if (sortBy == 'sort_name') {
    result.sort((a, b) => (a.sort_name || a.name).localeCompare(b.sort_name || b.name));
  }
  if (sortBy == 'sort_album') {
    result.sort((a, b) => (a as Track).album?.name.localeCompare((b as Track).album?.name));
  }
  if (sortBy == 'sort_artist') {
    result.sort((a, b) => (a as Track).artists[0].name.localeCompare((b as Track).artists[0].name));
  }
  if (sortBy == 'track_number') {
    result.sort((a, b) => ((a as Track).track_number || 0) - ((b as Track).track_number || 0));
    result.sort((a, b) => ((a as Track).disc_number || 0) - ((b as Track).disc_number || 0));
  }
  if (sortBy == 'position') {
    result.sort((a, b) => ((a as Track).position || 0) - ((b as Track).position || 0));
  }
  if (sortBy == 'position DESC') {
    result.sort((a, b) => ((b as Track).position || 0) - ((a as Track).position || 0));
  }
  if (sortBy == 'year') {
    result.sort((a, b) => ((a as Album).year || 0) - ((b as Album).year || 0));
  }
  if (sortBy == 'timestamp_added DESC') {
    result.sort((a, b) => (b.timestamp_added || 0) - (a.timestamp_added || 0));
  }

  if (sortBy == 'duration') {
    result.sort((a, b) => ((a as Track).duration || 0) - ((b as Track).duration || 0));
  }

  if (sortBy == 'provider') {
    result.sort((a, b) => a.provider.localeCompare(b.provider));
  }

  if (inLibraryOnly) {
    result = result.filter((x) => x.in_library);
  }

  const totalItems = result.length;
  const pagedItems = result.slice(offset, offset + limit);
  return {
    items: pagedItems,
    count: pagedItems.length,
    limit: limit,
    offset: offset,
    total: totalItems,
  };
};
</script>
