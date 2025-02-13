<!-- eslint-disable vue/no-v-for-template-key-on-child -->
<template>
  <section v-if="!(hideOnEmpty && pagedItems.length == 0)">
    <!-- eslint-disable vue/no-template-shadow -->
    <Toolbar
      :icon="icon"
      :title="title"
      :count="params.search ? pagedItems.length : total || allItems.length"
      color="transparent"
      :menu-items="menuItems"
      @title-clicked="toggleExpand"
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

    <Container
      v-if="expanded"
      :variant="viewMode == 'list' ? 'default' : 'panel'"
      style="overflow: hidden"
    >
      <v-infinite-scroll
        v-if="!tempHide && !(pagedItems.length == 0 && allItemsReceived)"
        :onLoad="loadNextPage"
        :mode="infiniteScroll ? 'intersect' : 'manual'"
        :load-more-text="$t('load_more_items')"
        :empty-text="''"
        style="overflow: hidden"
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
              :show-actions="['tracks', 'albums'].includes(itemtype)"
              :is-available="itemIsAvailable(item)"
              :parent-item="parentItem"
              @select="onSelect"
            />
          </v-col>
        </v-row>

        <!-- compact panel view -->
        <v-row v-if="viewMode == 'panel_compact'">
          <v-col
            v-for="item in pagedItems"
            :key="item.uri"
            cols="12"
            :class="`col-${panelViewItemResponsive($vuetify.display.width)}`"
          >
            <PanelviewItemCompact
              :item="item"
              :is-selected="isSelected(item)"
              :show-checkboxes="showCheckboxes"
              :is-available="itemIsAvailable(item)"
              :parent-item="parentItem"
              @select="onSelect"
            />
          </v-col>
        </v-row>

        <!-- list view -->
        <v-virtual-scroll
          v-if="viewMode == 'list'"
          :item-height="70"
          height="100%"
          :items="pagedItems"
          style="height: 100%; overflow: hidden"
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
              :is-available="itemIsAvailable(item)"
              :show-details="itemtype.includes('versions')"
              :parent-item="parentItem"
              @select="onSelect"
            />
          </template>
        </v-virtual-scroll>
      </v-infinite-scroll>

      <!-- show alert if no item found -->
      <div v-if="!loading && pagedItems.length == 0">
        <v-alert
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
            {{ $t("try_global_search") }}
          </v-btn>
        </v-alert>
        <v-alert v-else-if="!loading && pagedItems.length == 0">
          {{ $t("no_content") }}
        </v-alert>
      </div>

      <!-- box shown when item(s) selected -->
      <v-snackbar
        :model-value="selectedItems.length > 1"
        :timeout="-1"
        style="margin-bottom: 120px"
      >
        <span>{{ $t("items_selected", [selectedItems.length]) }}</span>
        <template #actions>
          <v-btn
            color="primary"
            variant="text"
            @click="
              (evt: PointerEvent) =>
                handleMenuBtnClick(
                  selectedItems,
                  evt.clientX,
                  evt.clientY,
                  parentItem,
                )
            "
          >
            {{ $t("actions") }}
          </v-btn>
        </template>
      </v-snackbar>
    </Container>
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
} from "vue";
import {
  MediaType,
  type Album,
  type MediaItemType,
  type Track,
  ItemMapping,
  MediaItemTypeOrItemMapping,
  EventMessage,
  EventType,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import ListviewItem from "./ListviewItem.vue";
import PanelviewItem from "./PanelviewItem.vue";
import PanelviewItemCompact from "./PanelviewItemCompact.vue";
import { useRouter } from "vue-router";
import { api } from "@/plugins/api";
import Container from "@/components/mods/Container.vue";
import Toolbar, { ToolBarMenuItem } from "@/components/Toolbar.vue";
import { itemIsAvailable } from "@/plugins/api/helpers";
import {
  panelViewItemResponsive,
  scrollElement,
  handleMenuBtnClick,
} from "@/helpers/utils";
import { useI18n } from "vue-i18n";

export interface LoadDataParams {
  offset: number;
  limit: number;
  sortBy: string;
  search: string;
  favoritesOnly?: boolean;
  albumArtistsFilter?: boolean;
  libraryOnly?: boolean;
  refresh?: boolean;
  albumType?: string[];
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
  showAlbumTypeFilter?: boolean;
  updateAvailable?: boolean;
  title?: string;
  hideOnEmpty?: boolean;
  showLibraryOnlyFilter?: boolean;
  allowCollapse?: boolean;
  allowKeyHooks?: boolean;
  extraMenuItems?: ToolBarMenuItem[];
  // loadPagedData callback is provided for serverside paging/sorting
  loadPagedData?: (params: LoadDataParams) => Promise<MediaItemType[]>;
  // loadItems callback is provided for flat non-paged listings
  loadItems?: (params: LoadDataParams) => Promise<MediaItemType[]>;
  limit?: number;
  total?: number;
  infiniteScroll?: boolean;
  path?: string;
  icon?: string;
  restoreState?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  sortKeys: () => ["name", "sort_name"],
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
  showAlbumTypeFilter: undefined,
  allowCollapse: false,
  allowKeyHooks: false,
  limit: 50,
  total: undefined,
  infiniteScroll: true,
  title: undefined,
  showLibraryOnlyFilter: false,
  extraMenuItems: undefined,
  loadPagedData: undefined,
  loadItems: undefined,
  path: undefined,
  icon: undefined,
  restoreState: false,
});

// global refs
const router = useRouter();
const { t } = useI18n();

// local refs
const params = ref<LoadDataParams>({
  offset: 0,
  limit: 50,
  sortBy: "name",
  search: "",
  libraryOnly: false,
});
const viewMode = ref("list");
const showSearch = ref(false);
const searchHasFocus = ref(false);
const pagedItems = ref<MediaItemType[]>([]);
const allItems = ref<MediaItemType[]>([]);
const loading = ref(false);
const selectedItems = ref<MediaItemTypeOrItemMapping[]>([]);
const newContentAvailable = ref(false);
const showCheckboxes = ref(false);
const expanded = ref(true);
const allItemsReceived = ref(false);
const initialDataReceived = ref(false);
const tempHide = ref(false);

// methods
const toggleSearch = function () {
  if (showSearch.value) showSearch.value = false;
  else {
    showSearch.value = true;
    nextTick(() => {
      document.getElementById("searchInput")?.focus();
    });
  }
};

const toggleExpand = function () {
  expanded.value = !expanded.value;
  const storKey = `${props.path}.${props.itemtype}`;
  localStorage.setItem(`expand.${storKey}`, expanded.value.toString());
};

const selectViewMode = function (newMode: string) {
  viewMode.value = newMode;
  const storKey = `${props.path}.${props.itemtype}`;
  localStorage.setItem(`viewMode.${storKey}`, newMode);
};

const toggleFavoriteFilter = function () {
  params.value.favoritesOnly = !params.value.favoritesOnly;
  const favoritesOnlyStr = params.value.favoritesOnly ? "true" : "false";
  const storKey = `${props.path}.${props.itemtype}`;
  localStorage.setItem(`favoriteFilter.${storKey}`, favoritesOnlyStr);
  loadData(undefined, undefined, true);
};

const toggleLibraryOnlyFilter = function () {
  params.value.libraryOnly = !params.value.libraryOnly;
  const libraryOnlyStr = params.value.libraryOnly ? "true" : "false";
  const storKey = `${props.path}.${props.itemtype}`;
  localStorage.setItem(`libraryFilter.${storKey}`, libraryOnlyStr);
  loadData(true, undefined, true);
};

const toggleAlbumArtistsFilter = function () {
  params.value.albumArtistsFilter = !params.value.albumArtistsFilter;
  const albumArtistsOnlyStr = params.value.albumArtistsFilter
    ? "true"
    : "false";
  const storKey = `${props.path}.${props.itemtype}`;
  localStorage.setItem(`albumArtistsFilter.${storKey}`, albumArtistsOnlyStr);
  loadData(undefined, undefined, true);
};

const isSelected = function (item: MediaItemTypeOrItemMapping) {
  return selectedItems.value.includes(item);
};

const onSelect = function (
  item: MediaItemTypeOrItemMapping,
  selected: boolean,
) {
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

const onRefreshClicked = function () {
  loadData(true, true);
};

const onClear = function () {
  params.value.search = "";
  showSearch.value = false;
  loadData(undefined, undefined, true);
};

const changeSort = function (sort_key?: string) {
  if (sort_key !== undefined) {
    params.value.sortBy = sort_key;
  }
  const storKey = `${props.path}.${props.itemtype}`;
  localStorage.setItem(`sortBy.${storKey}`, params.value.sortBy);
  loadData(undefined, undefined, true);
};

const changeAlbumTypeFilter = function (albumType: string) {
  if (params.value.albumType?.includes(albumType))
    params.value.albumType = params.value.albumType?.filter(
      (type) => type !== albumType,
    );
  else {
    params.value.albumType = params.value.albumType || [];
    params.value.albumType.push(albumType);
  }
  const storKey = `${props.path}.${props.itemtype}`;
  localStorage.setItem(
    `albumType.${storKey}`,
    params.value.albumType.join(","),
  );
  loadData(undefined, undefined, true);
};

const redirectSearch = function () {
  store.globalSearchTerm = params.value.search;
  if (props.itemtype == "artists") {
    store.globalSearchType = MediaType.ARTIST;
  } else if (props.itemtype == "albums") {
    store.globalSearchType = MediaType.ALBUM;
  } else if (props.itemtype == "tracks") {
    store.globalSearchType = MediaType.TRACK;
  } else if (props.itemtype == "playlists") {
    store.globalSearchType = MediaType.PLAYLIST;
  } else if (props.itemtype == "audiobooks") {
    store.globalSearchType = MediaType.AUDIOBOOK;
  } else if (props.itemtype == "podcasts") {
    store.globalSearchType = MediaType.PODCAST;
  } else if (props.itemtype == "radios") {
    store.globalSearchType = MediaType.RADIO;
  }
  router.push({ name: "search" });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadNextPage = function ({ done }: { done: any }) {
  if (allItemsReceived.value) {
    done("empty");
    return;
  }
  loadData(
    undefined,
    undefined,
    undefined,
    params.value.offset + props.limit,
  ).then(() => {
    done("ok");
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
        label: "tooltip.collapse_expand",
        icon: "mdi-chevron-down",
        action: toggleExpand,
        overflowAllowed: false,
      },
    ];
  }

  const items: ToolBarMenuItem[] = [];

  // toggle select menu item
  if (props.showSelectButton !== false) {
    items.push({
      label: "tooltip.select_items",
      icon: showCheckboxes.value
        ? "mdi-checkbox-multiple-outline"
        : "mdi-checkbox-multiple-blank-outline",
      action: toggleCheckboxes,
      active: showCheckboxes.value,
    });
  }
  // library only filter
  if (props.showLibraryOnlyFilter === true) {
    items.push({
      label: "tooltip.filter_library",
      icon: "mdi-bookshelf",
      action: toggleLibraryOnlyFilter,
      active: params.value.libraryOnly,
    });
  }

  // favorites only filter
  if (props.showFavoritesOnlyFilter === true) {
    items.push({
      label: "tooltip.filter_favorites",
      icon: params.value.favoritesOnly ? "mdi-heart" : "mdi-heart-outline",
      action: toggleFavoriteFilter,
      active: params.value.favoritesOnly,
    });
  }

  // album artists only filter
  if (props.showAlbumArtistsOnlyFilter === true) {
    items.push({
      label: "tooltip.album_artist_filter",
      icon: params.value.albumArtistsFilter
        ? "mdi-account-music"
        : "mdi-account-music-outline",
      action: toggleAlbumArtistsFilter,
      active: params.value.albumArtistsFilter,
    });
  }

  // album type filter
  if (props.showAlbumTypeFilter) {
    items.push({
      label: "tooltip.album_type",
      icon: "mdi-album",
      disabled: loading.value,
      subItems: ["album", "single", "ep", "compilation", "unknown"].map(
        (key) => {
          return {
            label: `album_type.${key}`,
            selected: params.value.albumType?.includes(key),
            action: () => {
              changeAlbumTypeFilter(key);
            },
          };
        },
      ),
    });
  }

  // refresh action
  if (props.showRefreshButton !== false || newContentAvailable.value) {
    items.push({
      label: newContentAvailable.value
        ? "tooltip.refresh_new_content"
        : "tooltip.refresh",
      icon: "mdi-refresh",
      action: onRefreshClicked,
      active: newContentAvailable.value,
      disabled: loading.value,
    });
  }

  // sort options
  if (props.sortKeys?.length) {
    items.push({
      label: "tooltip.sort_options",
      icon: "mdi-sort",
      disabled: props.sortKeys.length <= 1 || loading.value,
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
        ? "tooltip.search_filter_active"
        : "tooltip.search",
      icon: "mdi-magnify",
      action: toggleSearch,
      active: isSearchActive.value,
      disabled: loading.value,
    });
  }

  // toggle view mode
  items.push({
    label: "tooltip.toggle_view_mode",
    icon: viewMode.value == "list" ? "mdi-view-list" : "mdi-grid",
    subItems: [
      {
        label: "view.list",
        icon: "mdi-view-list",
        selected: viewMode.value == "list",
        action: () => {
          selectViewMode("list");
        },
      },
      {
        label: "view.panel",
        icon: "mdi-grid",
        selected: viewMode.value == "panel",
        action: () => {
          selectViewMode("panel");
        },
      },
      {
        label: "view.panel_compact",
        icon: "mdi-grid",
        selected: viewMode.value == "panel_compact",
        action: () => {
          selectViewMode("panel_compact");
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
      label: "tooltip.collapse_expand",
      icon: "mdi-chevron-up",
      action: toggleExpand,
    });
  }

  return items;
});

const loadData = async function (
  clear = false,
  refresh = false,
  FilterParamsChanged = false,
  offset = 0,
) {
  if (loading.value) {
    // we could potentially be called multiple times due to multiple watchers
    // so ignore if we're already loading
    return;
  }
  loading.value = true;

  if (FilterParamsChanged && props.loadPagedData != null) {
    // on paged server listings, we need to clear the list on filter params change
    clear = true;
  }

  if (clear || refresh) {
    offset = 0;
    if (allItemsReceived.value) {
      // this hack is needed in order to force refresh the infinite scroller
      // otherwise it will not attempt to load more items if the end was reached
      // and then we load new items with a different size
      tempHide.value = true;
    }
    allItemsReceived.value = false;
    initialDataReceived.value = false;
    newContentAvailable.value = false;
  }
  params.value.offset = offset;
  params.value.limit = props.limit;
  params.value.refresh = refresh;

  if (props.loadPagedData != null) {
    // server side paged listing (with filter support)
    const nextItems = await props.loadPagedData(params.value);
    if (params.value.offset) {
      pagedItems.value.push(...nextItems);
    } else {
      pagedItems.value = nextItems;
    }
    if (Math.abs(nextItems.length - props.limit) > 10) {
      allItemsReceived.value = true;
    }
  } else if (props.loadItems != null) {
    // grab items from loadItems callback
    if (!initialDataReceived.value || refresh) {
      // load all items from the callback
      allItems.value = await props.loadItems(params.value);
      initialDataReceived.value = true;
    }
    // filter items
    const nextItems = getFilteredItems(allItems.value, params.value);
    if (params.value.offset) {
      pagedItems.value.push(...nextItems);
    } else {
      pagedItems.value = nextItems;
    }
    // mark allItemsReceived if we have all items
    allItemsReceived.value = nextItems.length < props.limit;
  }
  params.value.refresh = false;
  loading.value = false;
  tempHide.value = false;
};

const restoreSettings = async function () {
  // restore settings for this path/itemtype
  const storKey = `${props.path}.${props.itemtype}`;
  // get stored/default viewMode for this itemtype
  const savedViewMode = localStorage.getItem(`viewMode.${storKey}`);
  if (savedViewMode && savedViewMode !== "null") {
    viewMode.value = savedViewMode;
  } else if (props.itemtype == "artists") {
    viewMode.value = "panel";
  } else if (props.itemtype == "albums") {
    viewMode.value = "panel";
  } else {
    viewMode.value = "list";
  }
  // get stored/default sortBy for this itemtype
  const savedSortBy = localStorage.getItem(`sortBy.${storKey}`);
  if (
    savedSortBy &&
    savedSortBy !== "null" &&
    props.sortKeys.includes(savedSortBy)
  ) {
    params.value.sortBy = savedSortBy;
  } else {
    params.value.sortBy = props.sortKeys[0];
  }

  // get stored/default favoriteOnlyFilter for this itemtype
  if (props.showFavoritesOnlyFilter !== false) {
    const savedInFavoriteOnlyStr = localStorage.getItem(
      `favoriteFilter.${storKey}`,
    );
    if (savedInFavoriteOnlyStr && savedInFavoriteOnlyStr == "true") {
      params.value.favoritesOnly = true;
    }
  }

  // get stored/default libraryOnlyFilter for this itemtype
  if (props.showLibraryOnlyFilter !== false) {
    const savedLibraryOnlyStr = localStorage.getItem(
      `libraryFilter.${storKey}`,
    );
    if (savedLibraryOnlyStr && savedLibraryOnlyStr == "true") {
      params.value.libraryOnly = true;
    }
  }

  // get stored/default albumArtistsOnlyFilter for this itemtype
  if (props.showAlbumArtistsOnlyFilter !== false) {
    const albumArtistsOnlyStr = localStorage.getItem(
      `albumArtistsFilter.${storKey}`,
    );
    if (albumArtistsOnlyStr) {
      params.value.albumArtistsFilter = albumArtistsOnlyStr == "true";
    }
  }

  // get stored/default expand property for this itemtype
  if (props.allowCollapse !== false) {
    const expandStr = localStorage.getItem(`expand.${storKey}`);
    if (expandStr) {
      expanded.value = expandStr == "true";
    }
  }

  // get stored/default albumType filter for this itemtype
  if (props.showAlbumTypeFilter === true) {
    const savedAlbumTypeFilterStr = localStorage.getItem(
      `albumType.${storKey}`,
    );
    if (savedAlbumTypeFilterStr) {
      params.value.albumType = savedAlbumTypeFilterStr.split(",");
    }
  }

  // get stored searchquery (but only if we're allowed to store the state)
  if (props.restoreState) {
    let savedSearchKey = `search.${storKey}`;
    if (props.parentItem) savedSearchKey += props.parentItem.item_id;
    const savedSearch = localStorage.getItem(savedSearchKey);
    if (savedSearch && savedSearch !== "null") {
      params.value.search = savedSearch;
    }
  }
};

// lifecycle hooks
const keyListener = function (e: KeyboardEvent) {
  if (store.dialogActive) return;
  if (loading.value) return;
  if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    selectedItems.value = pagedItems.value;
    showCheckboxes.value = true;
  } else if (!searchHasFocus.value && e.key == "Backspace") {
    params.value.search = params.value.search.slice(0, -1);
  } else if (!searchHasFocus.value && e.key.length == 1) {
    params.value.search += e.key;
    showSearch.value = true;
  }
};

if (props.allowKeyHooks) {
  document.addEventListener("keydown", keyListener);
  onBeforeUnmount(() => {
    document.removeEventListener("keydown", keyListener);
  });
}

if (props.restoreState) {
  // handle restore state
  onBeforeUnmount(() => {
    const key = props.path || props.itemtype;
    const el = document.querySelector("#cont");
    store.prevState = {
      path: key,
      scrollPos: el?.scrollTop || 0,
      pagedItems: pagedItems.value,
      allItems: allItems.value,
      allItemsReceived: allItemsReceived.value,
      initialDataReceived: initialDataReceived.value,
      params: params.value,
    };
  });
}

// watchers
watch(
  () => params.value.search,
  (newVal) => {
    if (newVal) showSearch.value = true;
    loadData(undefined, undefined, true);
    let storKey = `search.${props.path}.${props.itemtype}`;
    if (props.parentItem) storKey += props.parentItem.item_id;
    localStorage.setItem(storKey, params.value.search);
  },
);
watch(
  () => props.path,
  (newVal) => {
    if (loading.value == true) return;
    // completely reset if the path changes
    pagedItems.value = [];
    allItems.value = [];
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
    params.value = store.prevState.params;
    pagedItems.value = store.prevState.pagedItems;
    allItems.value = store.prevState.allItems;
    allItemsReceived.value = store.prevState.allItemsReceived;
    initialDataReceived.value = store.prevState.initialDataReceived;
    // scroll the main listing back to its previous scroll position
    nextTick(() => {
      const el = document.getElementById("cont");
      if (el) {
        scrollElement(el, store.prevState!.scrollPos, 50);
      }
    });
    loading.value = false;
  } else {
    loadData(true);
  }

  // signal if/when items get played/updated/removed
  const unsub = api.subscribe_multi(
    [
      EventType.MEDIA_ITEM_UPDATED,
      EventType.MEDIA_ITEM_DELETED,
      EventType.MEDIA_ITEM_PLAYED,
    ],
    (evt: EventMessage) => {
      if (evt.event == EventType.MEDIA_ITEM_DELETED) {
        pagedItems.value = pagedItems.value.filter(
          (i) => i.uri != evt.object_id,
        );
      } else if (evt.event == EventType.MEDIA_ITEM_UPDATED) {
        // update item
        const idx = pagedItems.value.findIndex((i) => i.uri == evt.object_id);
        if (idx >= 0) {
          pagedItems.value[idx] = evt.data;
        }
      } else if (evt.event == EventType.MEDIA_ITEM_PLAYED) {
        // update item
        const idx = pagedItems.value.findIndex((i) => i.uri == evt.object_id);
        if (idx >= 0) {
          if ("fully_played" in pagedItems.value[idx])
            pagedItems.value[idx].fully_played = evt.data["fully_played"];
          if ("resume_position_ms" in pagedItems.value[idx])
            pagedItems.value[idx].resume_position_ms =
              evt.data["seconds_played"] * 1000;
        }
      }
    },
  );
  onBeforeUnmount(unsub);
});

export interface StoredState {
  path: string;
  scrollPos: number;
  pagedItems: MediaItemType[];
  allItems: MediaItemType[];
  allItemsReceived: boolean;
  initialDataReceived: boolean;
  params: LoadDataParams;
}

const getSortName = function (
  item: MediaItemType | ItemMapping,
  preferSortName = false,
) {
  if (!item) return "";
  if ("label" in item && item.label && item.name)
    return t(item.label, [item.name]);
  if ("label" in item && item.label) return t(item.label);
  if (preferSortName && "sort_name" in item && item.sort_name)
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
        "artist" in item &&
        item.artist?.name.toLowerCase().includes(searchStr)
      ) {
        result.push(item);
      } else if (
        "album" in item &&
        item.album?.name.toLowerCase().includes(searchStr)
      ) {
        result.push(item);
      } else if (
        "artists" in item &&
        item.artists &&
        item.artists.length &&
        item.artists[0].name.toLowerCase().includes(searchStr)
      ) {
        result.push(item);
      }
    }
  } else {
    result = [...items];
  }
  // sort
  if (params.sortBy == "name") {
    result.sort((a, b) =>
      getSortName(a).localeCompare(getSortName(b), undefined, {
        numeric: true,
      }),
    );
  }
  if (params.sortBy == "sort_name") {
    result.sort((a, b) =>
      getSortName(a, true).localeCompare(getSortName(b, true), undefined, {
        numeric: true,
      }),
    );
  }
  if (params.sortBy == "name_desc") {
    result.sort((a, b) =>
      getSortName(b).localeCompare(getSortName(a), undefined, {
        numeric: true,
      }),
    );
  }
  if (params.sortBy == "sort_name_desc") {
    result.sort((a, b) =>
      getSortName(b, true).localeCompare(getSortName(a, true), undefined, {
        numeric: true,
      }),
    );
  }

  if (params.sortBy == "album") {
    result.sort((a, b) =>
      getSortName((a as Track).album).localeCompare(
        getSortName((b as Track).album),
        undefined,
        { numeric: true },
      ),
    );
  }
  if (params.sortBy == "artist") {
    result.sort((a, b) =>
      getSortName((a as Track).artists[0]).localeCompare(
        getSortName((b as Track).artists[0]),
      ),
    );
  }
  if (params.sortBy == "track_number") {
    result.sort(
      (a, b) =>
        ((a as Track).track_number || 0) - ((b as Track).track_number || 0),
    );
    result.sort(
      (a, b) =>
        ((a as Track).disc_number || 0) - ((b as Track).disc_number || 0),
    );
  }
  if (params.sortBy == "position") {
    result.sort(
      (a, b) => ((a as Track).position || 0) - ((b as Track).position || 0),
    );
  }
  if (params.sortBy == "position_desc") {
    result.sort(
      (a, b) => ((b as Track).position || 0) - ((a as Track).position || 0),
    );
  }
  if (params.sortBy == "year") {
    result.sort((a, b) => ((a as Album).year || 0) - ((b as Album).year || 0));
  }
  if (params.sortBy == "year_desc") {
    result.sort((a, b) => ((b as Album).year || 0) - ((a as Album).year || 0));
  }
  if (params.sortBy == "recent") {
    result.sort((a, b) => (b.timestamp_added || 0) - (a.timestamp_added || 0));
  }

  if (params.sortBy == "duration") {
    result.sort(
      (a, b) => ((a as Track).duration || 0) - ((b as Track).duration || 0),
    );
  }
  if (params.sortBy == "duration_desc") {
    result.sort(
      (a, b) => ((b as Track).duration || 0) - ((a as Track).duration || 0),
    );
  }

  if (params.sortBy == "provider") {
    result.sort((a, b) => a.provider.localeCompare(b.provider));
  }

  if (params.favoritesOnly) {
    result = result.filter((x) => x.favorite);
  }

  if (params.albumType && params.albumType.length > 0) {
    result = result.filter((x) =>
      params.albumType?.includes((x as Album).album_type),
    );
  }
  return result.slice(params.offset, params.offset + params.limit);
};
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
