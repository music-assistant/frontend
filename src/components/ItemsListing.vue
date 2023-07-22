<!-- eslint-disable vue/no-v-for-template-key-on-child -->
<template>
  <section v-if="!(hideOnEmpty && allItems.length == 0)">
    <!-- eslint-disable vue/no-template-shadow -->
    <v-toolbar density="compact" variant="flat" style="height: 48px" color="transparent">
      <template #title>
        {{ title }}
        <v-badge
          v-if="getBreakpointValue('bp11')"
          color="grey"
          :content="selectedItems.length ? `${selectedItems.length}/${totalItems}` : totalItems"
          inline
        />
      </template>

      <template #append>
        <!-- toggle select button -->
        <Button
          v-if="showSelectButton != undefined ? showSelectButton : getBreakpointValue('bp1')"
          v-bind="props"
          variant="list"
          :icon="showCheckboxes ? 'mdi-checkbox-multiple-outline' : 'mdi-checkbox-multiple-blank-outline'"
          :title="$t('tooltip.select_items')"
          :disabled="!expanded"
          @click="toggleCheckboxes"
        />

        <!-- favorites only filter -->
        <Button
          v-if="showFavoritesOnlyFilter != undefined ? showAlbumArtistsOnlyFilter : getBreakpointValue('bp1')"
          v-bind="props"
          variant="list"
          :title="$t('tooltip.filter_favorites')"
          :disabled="!expanded"
          @click="toggleFavoriteFilter"
        >
          <v-icon :icon="favoritesOnly ? 'mdi-heart' : 'mdi-heart-outline'" />
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
          <v-icon :icon="albumArtistsOnlyFilter ? 'mdi-account-music' : 'mdi-account-music-outline'" />
        </Button>

        <!-- refresh button-->
        <Button
          v-if="showRefreshButton != undefined ? showRefreshButton : getBreakpointValue('bp1')"
          v-bind="props"
          variant="list"
          :title="updateAvailable ? $t('tooltip.refresh_new_content') : $t('tooltip.refresh')"
          :disabled="!expanded"
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
                    <v-icon v-if="sortBy == key" icon="mdi-check" />
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
          :icon="viewMode == 'panel' ? 'mdi-view-list' : 'mdi-grid'"
          variant="list"
          :title="$t('tooltip.toggle_view_mode')"
          :disabled="!expanded"
          @click="toggleViewMode()"
        />

        <!-- provider filter dropdown -->
        <v-menu v-if="providerFilter && providerFilter.length > 1" location="bottom end" :close-on-content-click="true">
          <template #activator="{ props }">
            <Button v-bind="props" variant="list" :disabled="!expanded">
              <ProviderIcon :domain="activeProviderFilter" :size="30" />
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
                    <v-icon v-if="activeProviderFilter == provId" icon="mdi-check" />
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
        <Button
          v-if="allowCollapse"
          :icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'"
          variant="list"
          :title="$t('tooltip.collapse_expand')"
          @click="toggleExpand"
        />
      </template>
    </v-toolbar>
    <v-divider />

    <v-text-field
        v-if="showSearch && expanded"
        id="searchInput"
        v-model="search"
        clearable
        prepend-inner-icon="mdi-magnify"
        :label="$t('search')"
        hide-details
        variant="filled"
        style="width: auto; margin-top: 10px"
        @focus="searchHasFocus = true"
        @blur="searchHasFocus = false"
      />
    <Container v-if="expanded">
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
            :context-menu-items="showMenu ? getContextMenuItems([item], parentItem) : []"
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
import { type Album, type MediaItemType, type PagedItems, type Track } from '../plugins/api/interfaces';
import { RecycleScroller } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
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
  allowCollapse: false,
  allowKeyHooks: false,
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
const newContentAvailable = ref(false);
const showCheckboxes = ref(false);
const albumArtistsOnlyFilter = ref(true);
const activeProviderFilter = ref<string>('library');
const expanded = ref(true);

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
  loadData(true);
};

const onClick = function (mediaItem: MediaItemType) {
  // mediaItem in the list is clicked
  if (!itemIsAvailable(mediaItem)) {
    onMenu(mediaItem, false);
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
    onMenu(mediaItem, false);
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
    console.log('savedSearch', savedSearch);
    search.value = savedSearch;
  }
  loadData(true);
});

// lifecycle hooks
const keyListener = function (e: KeyboardEvent) {
  if (store.dialogActive) return;
  if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    // CTRL-A (select all requested)
    // fetch all items first
    while (allItems.value.length < totalItems.value!) {
      if (totalItems.value !== undefined && offset.value >= totalItems.value) {
        break;
      }
      offset.value += defaultLimit;
      loadData();
    }
    selectedItems.value = allItems.value;
    showCheckboxes.value = true;
  } else if (!searchHasFocus.value && e.key == 'Backspace') {
    search.value = search.value.slice(0, -1);
  } else if (!searchHasFocus.value && e.key.length == 1) {
    search.value += e.key;
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
