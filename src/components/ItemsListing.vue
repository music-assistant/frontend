<!-- eslint-disable vue/no-v-for-template-key-on-child -->
<template>
  <section v-if="!(hideOnEmpty && pagedItems.length == 0)">
    <!-- eslint-disable vue/no-template-shadow -->
    <Toolbar
      :icon="icon"
      :title="title"
      :count="total"
      color="transparent"
      :menu-items="menuItems"
    />

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
      @click:clear="onClear"
    />

    <transition name="fade">
      <Container
        v-if="expanded"
        :variant="viewMode == 'panel' ? 'panel' : 'default'"
      >
        <!-- loading animation -->
        <v-progress-linear v-if="loading" indeterminate />

        <v-infinite-scroll
          :items="pagedItems"
          :onLoad="loadNextPage"
          :mode="infiniteScroll ? 'intersect' : 'manual'"
          :load-more-text="$t('load_more_items')"
          :empty-text="''"
          style="overflow-y: unset"
        >
          <!-- panel view -->
          <v-row v-if="viewMode == 'panel'">
            <v-col
              v-for="item in pagedItems"
              :key="item.uri"
              cols="12"
              :class="`col-${panelViewItemResponsive($vuetify.display.width)}`"
            >
              <PanelviewItem
                :item="item"
                :is-selected="isSelected(item)"
                :show-checkboxes="showCheckboxes"
                :show-track-number="showTrackNumber"
                :show-favorite="showFavoritesOnlyFilter"
                :show-actions="['tracks', 'albums'].includes(itemtype)"
                @select="onSelect"
                @menu="onMenu"
                @click="onClick"
              />
            </v-col>
          </v-row>

          <!-- list view -->
          <v-virtual-scroll
            v-if="viewMode == 'list'"
            :height="70"
            :items="pagedItems"
            style="height: 100%"
          >
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
                @select="onSelect"
                @menu="onMenu"
                @click="onClick"
              />
            </template>
          </v-virtual-scroll>
        </v-infinite-scroll>

        <!-- show alert if no item found -->
        <div v-if="!loading && pagedItems.length == 0">
          <Alert
            v-if="
              !loading &&
              pagedItems.length == 0 &&
              (params.search || params.favoritesOnly)
            "
            :title="$t('no_content_filter')"
          >
            <v-btn
              v-if="params.search"
              style="margin-top: 15px"
              @click="redirectSearch"
            >
              {{ $t('try_global_search') }}
            </v-btn>
          </Alert>
          <Alert v-else-if="!loading && pagedItems.length == 0">
            {{ $t('no_content') }}
          </Alert>
        </div>

        <!-- box shown when item(s) selected -->
        <v-snackbar
          :model-value="selectedItems.length > 1"
          :timeout="-1"
          style="margin-bottom: 120px"
        >
          <span>{{ $t('items_selected', [selectedItems.length]) }}</span>
          <template #actions>
            <v-btn
              color="primary"
              variant="text"
              @click="(evt: Event) => onMenu(evt, selectedItems)"
            >
              {{ $t('actions') }}
            </v-btn>
          </template>
        </v-snackbar>
      </Container>
    </transition>
  </section>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-unused-vars,vue/no-setup-props-destructure */

import {
  computed,
  ref,
  onBeforeUnmount,
  nextTick,
  onMounted,
  watch,
} from 'vue';
import {
  MediaType,
  type Album,
  type MediaItemType,
  type PagedItems,
  type Track,
  BrowseFolder,
  ItemMapping,
} from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import ListviewItem from './ListviewItem.vue';
import PanelviewItem from './PanelviewItem.vue';
import { useRouter } from 'vue-router';
import { api } from '@/plugins/api';
import Alert from '@/components/mods/Alert.vue';
import Container from '@/components/mods/Container.vue';
import { useI18n } from 'vue-i18n';
import Toolbar, { ToolBarMenuItem } from '@/components/Toolbar.vue';
import { itemIsAvailable } from '@/plugins/api/helpers';
import { showContextMenuForMediaItem } from '@/layouts/default/ItemContextMenu.vue';
import { panelViewItemResponsive, scrollElement, sleep } from '@/helpers/utils';

export interface LoadDataParams {
  offset: number;
  limit: number;
  sortBy: string;
  search: string;
  favoritesOnly?: boolean;
  albumArtistsFilter?: boolean;
  libraryOnly?: boolean;
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
  showLibraryOnlyFilter?: boolean;
  allowCollapse?: boolean;
  allowKeyHooks?: boolean;
  extraMenuItems?: ToolBarMenuItem[];
  // loadPagedData callback is provided for serverside paging/sorting
  loadPagedData?: (params: LoadDataParams) => Promise<PagedItems>;
  // loadItems callback is provided for flat non-paged listings
  loadItems?: (params: LoadDataParams) => Promise<MediaItemType[]>;
  limit?: number;
  infiniteScroll?: boolean;
  path?: string;
  icon?: string;
  restoreState?: boolean;
  noServerSideSorting?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  sortKeys: () => ['name', 'sort_name'],
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
  limit: 50,
  infiniteScroll: true,
  title: undefined,
  showLibraryOnlyFilter: false,
  extraMenuItems: undefined,
  loadPagedData: undefined,
  loadItems: undefined,
  path: undefined,
  icon: undefined,
  restoreState: false,
  noServerSideSorting: false,
});

export interface StoredState {
  path: string;
  scrollPos: number;
  pagedItems: MediaItemType[];
  params: LoadDataParams;
  total: number;
}

// global refs
const router = useRouter();

// local refs
const params = ref<LoadDataParams>({
  offset: 0,
  limit: 50,
  sortBy: 'name',
  search: '',
  libraryOnly: false,
});
const viewMode = ref('list');
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
const allItemsReceived = ref(false);

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

const toggleExpand = function () {
  expanded.value = !expanded.value;
  localStorage.setItem(`expand.${props.itemtype}`, expanded.value.toString());
};

const selectViewMode = function (newMode: string) {
  viewMode.value = newMode;
  localStorage.setItem(`viewMode.${props.itemtype}`, newMode);
};

const toggleFavoriteFilter = function () {
  params.value.favoritesOnly = !params.value.favoritesOnly;
  const favoritesOnlyStr = params.value.favoritesOnly ? 'true' : 'false';
  localStorage.setItem(`favoriteFilter.${props.itemtype}`, favoritesOnlyStr);
  loadData(true);
};

const toggleLibraryOnlyFilter = function () {
  params.value.libraryOnly = !params.value.libraryOnly;
  const libraryOnlyStr = params.value.libraryOnly ? 'true' : 'false';
  localStorage.setItem(`libraryFilter.${props.itemtype}`, libraryOnlyStr);
  loadData(true, true);
};

const toggleAlbumArtistsFilter = function () {
  params.value.albumArtistsFilter = !params.value.albumArtistsFilter;
  const albumArtistsOnlyStr = params.value.albumArtistsFilter
    ? 'true'
    : 'false';
  localStorage.setItem(
    `albumArtistsFilter.${props.itemtype}`,
    albumArtistsOnlyStr,
  );
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

const onMenu = function (evt: Event, item: MediaItemType | MediaItemType[]) {
  const mediaItems: MediaItemType[] = Array.isArray(item) ? item : [item];
  showContextMenuForMediaItem(
    mediaItems,
    props.parentItem,
    (evt as PointerEvent).clientX,
    (evt as PointerEvent).clientY,
  );
};

const onRefreshClicked = function () {
  emit('refreshClicked');
  loadData(true, true);
};

const onClick = function (evt: Event, item: MediaItemType) {
  // mediaItem in the list is clicked
  if (!itemIsAvailable(item)) {
    onMenu(evt, item);
    return;
  }
  if (item.media_type == MediaType.FOLDER) {
    router.push({
      name: 'browse',
      query: {
        path: (item as BrowseFolder).path,
      },
    });
  } else if (['artist', 'album', 'playlist'].includes(item.media_type)) {
    router.push({
      name: item.media_type,
      params: {
        itemId: item.item_id,
        provider: item.provider,
      },
    });
  } else {
    onMenu(evt, item);
  }
};

const onPlayClick = function (evt: Event, item: MediaItemType) {
  if (!itemIsAvailable(item)) {
    onMenu(evt, item);
    return;
  }
  if (!store.activePlayerId) {
    store.showPlayersMenu = true;
    return;
  }
  api.playMedia(item.uri, undefined);
};

const onClear = function () {
  params.value.search = '';
  showSearch.value = false;
  loadData(true);
};

const changeSort = function (sort_key?: string, sort_desc?: boolean) {
  if (sort_key !== undefined) {
    params.value.sortBy = sort_key;
  }
  localStorage.setItem(`sortBy.${props.itemtype}`, params.value.sortBy);
  loadData(true, sort_key == 'original');
};

const redirectSearch = function () {
  store.globalSearchTerm = params.value.search;
  router.push({ name: 'search' });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadNextPage = function ({ done }: { done: any }) {
  if (pagedItems.value.length == 0) {
    done('empty');
    return;
  }
  if (allItemsReceived.value) {
    done('empty');
    return;
  }

  done('loading');
  params.value.offset += props.limit;
  loadData().then(() => {
    done('ok');
  });
};

// computed properties
const isSearchActive = computed(() => {
  var searchActive = false;
  if (params.value.search && params.value.search.length !== 0) {
    searchActive = true;
  }
  return searchActive;
});

const menuItems = computed(() => {
  // toggle expand
  if (props.allowCollapse === true && !expanded.value) {
    return [
      {
        label: 'tooltip.collapse_expand',
        icon: 'mdi-chevron-down',
        action: toggleExpand,
        overflowAllowed: false,
      },
    ];
  }

  const items: ToolBarMenuItem[] = [];

  // toggle select menu item
  if (props.showSelectButton !== false) {
    items.push({
      label: 'tooltip.select_items',
      icon: showCheckboxes.value
        ? 'mdi-checkbox-multiple-outline'
        : 'mdi-checkbox-multiple-blank-outline',
      action: toggleCheckboxes,
      active: showCheckboxes.value,
    });
  }
  // library only filter
  if (props.showLibraryOnlyFilter === true) {
    items.push({
      label: 'tooltip.filter_library',
      icon: 'mdi-bookshelf',
      action: toggleLibraryOnlyFilter,
      active: params.value.libraryOnly,
    });
  }

  // favorites only filter
  if (props.showFavoritesOnlyFilter === true) {
    items.push({
      label: 'tooltip.filter_favorites',
      icon: params.value.favoritesOnly ? 'mdi-heart' : 'mdi-heart-outline',
      action: toggleFavoriteFilter,
      active: params.value.favoritesOnly,
    });
  }

  // album artists only filter
  if (props.showAlbumArtistsOnlyFilter === true) {
    items.push({
      label: 'tooltip.album_artist_filter',
      icon: params.value.albumArtistsFilter
        ? 'mdi-account-music'
        : 'mdi-account-music-outline',
      action: toggleAlbumArtistsFilter,
      active: params.value.albumArtistsFilter,
    });
  }

  // refresh action
  if (props.showRefreshButton !== false || newContentAvailable.value) {
    items.push({
      label: newContentAvailable.value
        ? 'tooltip.refresh_new_content'
        : 'tooltip.refresh',
      icon: 'mdi-refresh',
      action: onRefreshClicked,
      active: newContentAvailable.value,
      disabled: loading.value,
    });
  }

  // sort options
  if (props.sortKeys?.length) {
    items.push({
      label: 'tooltip.sort_options',
      icon: 'mdi-sort',
      subItems: props.sortKeys.map((sortKey) => {
        return {
          label: `sort.${sortKey}`,
          selected: params.value.sortBy == sortKey,
          action: () => {
            changeSort(sortKey);
          },
        };
      }),
    });
  }

  // toggle search
  if (props.showSearchButton !== false) {
    items.push({
      label: isSearchActive.value
        ? 'tooltip.search_filter_active'
        : 'tooltip.search',
      icon: 'mdi-magnify',
      action: toggleSearch,
      active: isSearchActive.value,
    });
  }

  // toggle view mode
  items.push({
    label: 'tooltip.toggle_view_mode',
    icon: viewMode.value == 'list' ? 'mdi-view-list' : 'mdi-grid',
    subItems: [
      {
        label: 'view.list',
        icon: 'mdi-view-list',
        selected: viewMode.value == 'list',
        action: () => {
          selectViewMode('list');
        },
      },
      {
        label: 'view.panel',
        icon: 'mdi-grid',
        selected: viewMode.value == 'panel',
        action: () => {
          selectViewMode('panel');
        },
      },
    ],
  });

  if (props.extraMenuItems?.length) {
    items.push(...props.extraMenuItems);
  }

  // toggle expand
  if (props.allowCollapse === true) {
    items.push({
      label: 'tooltip.collapse_expand',
      icon: 'mdi-chevron-up',
      action: toggleExpand,
    });
  }

  return items;
});

const loadData = async function (clear = false, refresh = false) {
  if (loading.value) {
    // we could potentially be called multiple times due to multiple watchers
    // so ignore if we're already loading
    return;
  }
  loading.value = true;

  if (clear || refresh) {
    params.value.offset = 0;
    newContentAvailable.value = false;
  }
  params.value.limit = props.limit;
  params.value.refresh = refresh;

  if (props.loadPagedData !== undefined) {
    // server side paged listing (with optional filter/sort)
    if (props.noServerSideSorting && allItemsReceived.value) {
      // server side sorting not supported for this endpoint, handle it here
      params.value.offset = 0;
      params.value.limit = allItems.value.length;
      pagedItems.value = getFilteredItems(allItems.value, params.value);
    } else if (props.noServerSideSorting && params.value.search) {
      // annoying edge case, user wants to search but server side is paged without sorting/filtering support
      // we need to fetch all items first to so we can search using a filter
      allItems.value.push(...pagedItems.value);
      while (!allItemsReceived.value) {
        const nextItems = await props.loadPagedData(params.value);
        allItems.value.push(...(nextItems.items as MediaItemType[]));
        if (nextItems.total != null) {
          total.value = nextItems.total;
        }
        if (total.value != null && allItems.value.length >= total.value) {
          break;
        }
        params.value.offset += 50;
      }
      allItemsReceived.value = true;
      params.value.offset = 0;
      params.value.limit = total.value || params.value.limit;
      pagedItems.value = getFilteredItems(allItems.value, params.value);
    } else {
      // call server for paged listing
      const nextItems = await props.loadPagedData(params.value);
      if (params.value.offset) {
        pagedItems.value.push(...(nextItems.items as MediaItemType[]));
      } else {
        pagedItems.value = nextItems.items as MediaItemType[];
      }
      // the server should send total attribute as soon as it knows it
      if (nextItems.total != null) total.value = nextItems.total;
      // in case the server sends more or less items than limit, treat that as completion
      else if (nextItems.items.length != params.value.limit) {
        nextItems.total = pagedItems.value.length;
      }
      // mark all items received bool if we're complete
      allItemsReceived.value =
        total.value != null && pagedItems.value.length >= total.value;
      if (allItemsReceived.value && props.noServerSideSorting) {
        allItems.value = pagedItems.value;
      }
    }
  } else if (props.loadItems !== undefined) {
    // grab items from loadItems callback
    if (!allItemsReceived.value || refresh) {
      // load all items from the callback
      allItems.value = [];
      (allItems.value = await props.loadItems(params.value)), params.value;
      total.value = allItems.value.length;
      allItemsReceived.value = true;
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

const getSortName = function (
  item: MediaItemType | ItemMapping,
  preferSortName = false,
) {
  if (!item) return '';
  if ('label' in item && item.label && item.name)
    return t(item.label, [item.name]);
  if ('label' in item && item.label) return t(item.label);
  if (preferSortName && 'sort_name' in item && item.sort_name)
    return item.sort_name;
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
      } else if (
        'artist' in item &&
        item.artist?.name.toLowerCase().includes(searchStr)
      ) {
        result.push(item);
      } else if (
        'album' in item &&
        item.album?.name.toLowerCase().includes(searchStr)
      ) {
        result.push(item);
      } else if (
        'artists' in item &&
        item.artists &&
        item.artists[0].name.toLowerCase().includes(searchStr)
      ) {
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
  if (params.sortBy == 'sort_name') {
    result.sort((a, b) =>
      getSortName(a, true).localeCompare(getSortName(b, true)),
    );
  }
  if (params.sortBy == 'name_desc') {
    result.sort((a, b) => getSortName(b).localeCompare(getSortName(a)));
  }

  if (params.sortBy == 'album') {
    result.sort((a, b) =>
      getSortName((a as Track).album).localeCompare(
        getSortName((b as Track).album),
      ),
    );
  }
  if (params.sortBy == 'artist') {
    result.sort((a, b) =>
      getSortName((a as Track).artists[0]).localeCompare(
        getSortName((b as Track).artists[0]),
      ),
    );
  }
  if (params.sortBy == 'track_number') {
    result.sort(
      (a, b) =>
        ((a as Track).track_number || 0) - ((b as Track).track_number || 0),
    );
    result.sort(
      (a, b) =>
        ((a as Track).disc_number || 0) - ((b as Track).disc_number || 0),
    );
  }
  if (params.sortBy == 'position') {
    result.sort(
      (a, b) => ((a as Track).position || 0) - ((b as Track).position || 0),
    );
  }
  if (params.sortBy == 'position_desc') {
    result.sort(
      (a, b) => ((b as Track).position || 0) - ((a as Track).position || 0),
    );
  }
  if (params.sortBy == 'year') {
    result.sort((a, b) => ((a as Album).year || 0) - ((b as Album).year || 0));
  }
  if (params.sortBy == 'recent') {
    result.sort((a, b) => (b.timestamp_added || 0) - (a.timestamp_added || 0));
  }

  if (params.sortBy == 'duration') {
    result.sort(
      (a, b) => ((a as Track).duration || 0) - ((b as Track).duration || 0),
    );
  }
  if (params.sortBy == 'duration_desc') {
    result.sort(
      (a, b) => ((b as Track).duration || 0) - ((a as Track).duration || 0),
    );
  }

  if (params.sortBy == 'provider') {
    result.sort((a, b) => a.provider.localeCompare(b.provider));
  }

  if (params.favoritesOnly) {
    result = result.filter((x) => x.favorite);
  }
  return result.slice(params.offset, params.offset + params.limit);
};

const restoreSettings = async function () {
  // restore settings for this path/itemtype
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
  if (
    savedSortBy &&
    savedSortBy !== 'null' &&
    props.sortKeys.includes(savedSortBy)
  ) {
    params.value.sortBy = savedSortBy;
  } else {
    params.value.sortBy = props.sortKeys[0];
  }

  // get stored/default favoriteOnlyFilter for this itemtype
  if (props.showFavoritesOnlyFilter !== false) {
    const savedInFavoriteOnlyStr = localStorage.getItem(
      `favoriteFilter.${props.itemtype}`,
    );
    if (savedInFavoriteOnlyStr && savedInFavoriteOnlyStr == 'true') {
      params.value.favoritesOnly = true;
    }
  }

  // get stored/default libraryOnlyFilter for this itemtype
  if (props.showLibraryOnlyFilter !== false) {
    const savedLibraryOnlyStr = localStorage.getItem(
      `libraryFilter.${props.itemtype}`,
    );
    if (savedLibraryOnlyStr && savedLibraryOnlyStr == 'true') {
      params.value.libraryOnly = true;
    }
  }

  // get stored/default albumArtistsOnlyFilter for this itemtype
  if (props.showAlbumArtistsOnlyFilter !== false) {
    const albumArtistsOnlyStr = localStorage.getItem(
      `albumArtistsFilter.${props.itemtype}`,
    );
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
};

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

if (props.restoreState) {
  // handle restore state
  onBeforeUnmount(() => {
    const key = props.path || props.itemtype;
    const el = document.querySelector('#cont');
    store.prevState = {
      path: key,
      scrollPos: el?.scrollTop || 0,
      pagedItems: pagedItems.value,
      params: params.value,
      total: total.value || 0,
    };
  });
}

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
  (newVal) => {
    console.debug('Path updated to', newVal);
    if (loading.value == true) return;
    // completely reset if the path changes
    pagedItems.value = [];
    allItems.value = [];
    allItemsReceived.value = false;
    loadData(true);
  },
);
watch(
  () => props.parentItem,
  () => {
    if (loading.value == true) return;
    allItems.value = [];
    newContentAvailable.value = true;
  },
  { deep: true },
);
watch(
  () => props.limit,
  (newVal) => {
    params.value.limit = newVal;
  },
);
watch(
  () => props.updateAvailable,
  (newVal) => {
    if (loading.value) return;
    newContentAvailable.value = newVal;
  },
  { immediate: true },
);

onMounted(async () => {
  restoreSettings();
  // for the main listings (e.g. artists, albums etc.) we remember the scroll position
  // so we can jump back there on back navigation
  const key = props.path || props.itemtype;
  if (props.restoreState && store.prevState?.path == key) {
    total.value = store.prevState.total;
    params.value = store.prevState.params;
    pagedItems.value = store.prevState.pagedItems;
    // scroll the main listing back to its previous scroll position
    nextTick(() => {
      const el = document.getElementById('cont');
      if (el) {
        scrollElement(el, store.prevState!.scrollPos, 50);
      }
    });
    loading.value = false;
  } else {
    loadData(true);
  }
});
</script>

<style scoped>
/* ThumbView panel columns */
.col-2 {
  width: 50%;
  max-width: 50%;
  flex-basis: 50%;
  padding: 8px;
}
.col-3 {
  width: 33.3%;
  max-width: 33.3%;
  flex-basis: 33.3%;
  padding: 8px;
}
.col-4 {
  width: 25%;
  max-width: 25%;
  flex-basis: 25%;
  padding: 8px;
}
.col-5 {
  width: 20%;
  max-width: 20%;
  flex-basis: 20%;
  padding: 8px;
}
.col-6 {
  width: 16.6%;
  max-width: 16.6%;
  flex-basis: 16.6%;
  padding: 8px;
}
.col-7 {
  width: 14.2%;
  max-width: 14.2%;
  flex-basis: 14.2%;
  padding: 8px;
}
.col-8 {
  width: 12.5%;
  max-width: 12.5%;
  flex-basis: 12.5%;
  padding: 8px;
}
.col-9 {
  width: 11.1%;
  max-width: 11.1%;
  flex-basis: 11.1%;
  padding: 8px;
}
</style>
