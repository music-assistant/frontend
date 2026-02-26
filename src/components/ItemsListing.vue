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
    >
      <template #title>
        <slot name="title">{{ title }}</slot>
      </template>
    </Toolbar>

    <v-divider />

    <v-text-field
      v-if="showSearchInput"
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
      <!-- Skeleton loading states -->
      <template v-if="loading && pagedItems.length === 0">
        <div v-if="viewMode === 'list'">
          <ListViewSkeleton v-for="n in 8" :key="'skeleton-list-' + n" />
        </div>
        <v-row v-else-if="viewMode === 'panel'">
          <v-col
            v-for="n in 12"
            :key="'skeleton-panel-' + n"
            cols="12"
            :class="`col-${panelViewItemResponsive($vuetify.display.width)}`"
          >
            <PanelViewSkeleton />
          </v-col>
        </v-row>
        <v-row v-else-if="viewMode === 'panel_compact'">
          <v-col
            v-for="n in 12"
            :key="'skeleton-compact-' + n"
            cols="12"
            :class="`col-${panelViewItemResponsive($vuetify.display.width)}`"
          >
            <PanelViewSkeleton />
          </v-col>
        </v-row>
      </template>

      <v-infinite-scroll
        v-if="
          !tempHide &&
          !(pagedItems.length == 0 && allItemsReceived) &&
          !(loading && pagedItems.length === 0)
        "
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
              :show-actions="
                ['tracks', 'albums', 'albumtracks'].includes(itemtype)
              "
              :show-track-number="showTrackNumber"
              :is-available="itemIsAvailable(item)"
              :is-playing="isPlaying(item, itemtype)"
              :disable-play-button="isPlayActionInProgress"
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
              :is-playing="isPlaying(item, itemtype)"
              :disable-play-button="isPlayActionInProgress"
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
              :show-menu="item.is_playable"
              :show-provider="showProvider"
              :show-album="showAlbum"
              :show-checkboxes="showCheckboxes"
              :is-selected="isSelected(item)"
              :is-available="itemIsAvailable(item)"
              :is-playing="isPlaying(item, itemtype)"
              :show-details="itemtype.includes('versions')"
              :disable-play-button="isPlayActionInProgress"
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
import type { Component } from "vue";

import Container from "@/components/Container.vue";
import ListViewSkeleton from "@/components/skeletons/ListViewSkeleton.vue";
import PanelViewSkeleton from "@/components/skeletons/PanelViewSkeleton.vue";
import Toolbar, { ToolBarMenuItem } from "@/components/Toolbar.vue";
import { useUserPreferences } from "@/composables/userPreferences";
import {
  handleMenuBtnClick,
  panelViewItemResponsive,
  scrollElement,
} from "@/helpers/utils";
import { api } from "@/plugins/api";
import { itemIsAvailable } from "@/plugins/api/helpers";
import {
  EventMessage,
  EventType,
  ItemMapping,
  MediaItemTypeOrItemMapping,
  MediaType,
  PlaybackState,
  PodcastEpisode,
  ProviderFeature,
  ProviderType,
  Radio,
  type Album,
  type MediaItemType,
  type Track,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  watchEffect,
} from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import ListviewItem from "./ListviewItem.vue";
import PanelviewItem from "./PanelviewItem.vue";
import PanelviewItemCompact from "./PanelviewItemCompact.vue";

export interface LoadDataParams {
  offset: number;
  limit: number;
  sortBy: string;
  search: string;
  genreIds?: number | number[];
  favoritesOnly?: boolean;
  albumArtistsFilter?: boolean;
  libraryOnly?: boolean;
  hideEmptyFilter?: boolean;
  refresh?: boolean;
  albumType?: string[];
  provider?: string[];
}
// properties
export interface Props {
  itemtype: string;
  sortKeys?: string[];
  showTrackNumber?: boolean;
  showProvider?: boolean;
  showAlbum?: boolean;
  showFavoritesOnlyFilter?: boolean;
  showDuration?: boolean;
  parentItem?: MediaItemType;
  showAlbumArtistsOnlyFilter?: boolean;
  showSearchButton?: boolean;
  showRefreshButton?: boolean;
  showSelectButton?: boolean;
  showAlbumTypeFilter?: boolean;
  showProviderFilter?: boolean;
  updateAvailable?: boolean;
  title?: string;
  hideOnEmpty?: boolean;
  showLibraryOnlyFilter?: boolean;
  showGenreFilter?: boolean;
  showHideEmptyFilter?: boolean;
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
  icon?: string | Component;
  restoreState?: boolean;
  onTitleClick?: () => void;
  refreshOnParentUpdate?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  sortKeys: () => ["name", "sort_name"],
  showTrackNumber: true,
  showProvider: Object.keys(api.providers).length > 1,
  showAlbum: true,
  showFavoritesOnlyFilter: true,
  showDuration: true,
  parentItem: undefined,
  hideOnEmpty: false,
  showSearchButton: undefined,
  showRefreshButton: undefined,
  showSelectButton: undefined,
  showAlbumTypeFilter: undefined,
  showProviderFilter: undefined,
  allowCollapse: false,
  allowKeyHooks: false,
  limit: 50,
  total: undefined,
  infiniteScroll: true,
  title: undefined,
  showLibraryOnlyFilter: false,
  showGenreFilter: false,
  showHideEmptyFilter: false,
  extraMenuItems: undefined,
  loadPagedData: undefined,
  loadItems: undefined,
  path: undefined,
  icon: undefined,
  restoreState: false,
  onTitleClick: undefined,
  refreshOnParentUpdate: false,
});

// global refs
const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const { getItemsListingPreferences, setItemsListingPreference } =
  useUserPreferences();

// local refs
const params = ref<LoadDataParams>({
  offset: 0,
  limit: 50,
  sortBy: "name",
  search: "",
  libraryOnly: false,
  genreIds: undefined,
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
const genreOptions = ref<{ label: string; value: number }[]>([]);

// methods
const applyQueryGenreFilter = function () {
  const queryGenre = route.query.genre_id ?? route.query.genre_ids;
  const parsedIds: number[] = [];
  const parseValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    for (const part of trimmed.split(",")) {
      const parsed = Number(part.trim());
      if (!Number.isNaN(parsed)) parsedIds.push(parsed);
    }
  };

  if (Array.isArray(queryGenre)) {
    for (const value of queryGenre) {
      if (typeof value !== "string") continue;
      parseValue(value);
    }
  } else if (typeof queryGenre === "string") {
    parseValue(queryGenre);
  }
  const nextGenreIds = parsedIds.length === 0 ? undefined : parsedIds;
  const changed =
    JSON.stringify(params.value.genreIds) !== JSON.stringify(nextGenreIds);
  params.value.genreIds = nextGenreIds;
  return changed;
};
const closeSearch = function () {
  params.value.search = "";
  showSearch.value = false;
};
const focusSearch = function () {
  nextTick(() => {
    document.getElementById("searchInput")?.focus();
  });
};
const toggleSearch = function () {
  if (showSearch.value) {
    closeSearch();
  } else {
    showSearch.value = true;
    focusSearch();
  }
};

const toggleExpand = function () {
  // If a custom title click handler is provided, use it
  if (props.onTitleClick) {
    props.onTitleClick();
    return;
  }

  // Otherwise, use the default expand/collapse behavior
  expanded.value = !expanded.value;
  setItemsListingPreference(
    props.path || props.itemtype,
    props.itemtype,
    "expand",
    expanded.value,
  );
};

const selectViewMode = function (newMode: string) {
  viewMode.value = newMode;
  setItemsListingPreference(
    props.path || props.itemtype,
    props.itemtype,
    "viewMode",
    newMode,
  );
};

const toggleFavoriteFilter = function () {
  params.value.favoritesOnly = !params.value.favoritesOnly;
  setItemsListingPreference(
    props.path || props.itemtype,
    props.itemtype,
    "favoriteFilter",
    params.value.favoritesOnly,
  );
  loadData(undefined, undefined, true);
};

const toggleLibraryOnlyFilter = function () {
  params.value.libraryOnly = !params.value.libraryOnly;
  setItemsListingPreference(
    props.path || props.itemtype,
    props.itemtype,
    "libraryFilter",
    params.value.libraryOnly,
  );
  loadData(true, undefined, true);
};

const toggleAlbumArtistsFilter = function () {
  params.value.albumArtistsFilter = !params.value.albumArtistsFilter;
  setItemsListingPreference(
    props.path || props.itemtype,
    props.itemtype,
    "albumArtistsFilter",
    params.value.albumArtistsFilter,
  );
  loadData(undefined, undefined, true);
};

const toggleHideEmptyFilter = function () {
  params.value.hideEmptyFilter = !params.value.hideEmptyFilter;
  setItemsListingPreference(
    props.path || props.itemtype,
    props.itemtype,
    "hideEmptyFilter",
    params.value.hideEmptyFilter,
  );
  loadData(undefined, undefined, true);
};

const toggleGenreFilter = function (genreId: number) {
  // normalize current ids to an array
  const current = params.value.genreIds;
  let ids: number[] = [];
  if (Array.isArray(current)) {
    ids = [...current];
  } else if (typeof current === "number") {
    ids = [current];
  }

  if (ids.includes(genreId)) {
    ids = ids.filter((id) => id !== genreId);
  } else {
    ids.push(genreId);
  }

  if (ids.length === 0) {
    params.value.genreIds = undefined;
  } else {
    params.value.genreIds = ids;
  }

  // keep URL in sync so back/refresh preserves filters
  const query = { ...route.query };
  if (ids.length) {
    query.genre_ids = ids.join(",");
  }
  // Always remove legacy single-genre param so we have a single source of truth
  if (!ids.length) {
    delete query.genre_ids;
  }
  delete query.genre_id;
  router.replace({ query });

  // reload with updated filters
  loadData(true, undefined, true);
};

const isSelected = function (item: MediaItemTypeOrItemMapping) {
  return selectedItems.value.includes(item);
};

const isPlaying = function (item: MediaItemType, itemtype: string): boolean {
  if (store.activePlayer?.playback_state != PlaybackState.PLAYING) return false;
  const current = store.curQueueItem?.media_item as
    | Track
    | Radio
    | PodcastEpisode
    | undefined;
  if (!current) return false;
  switch (itemtype) {
    case "tracks":
    case "playlisttracks":
    case "albumtracks":
    case "artisttracks": {
      return item.item_id === current.item_id;
    }
    case "albums": {
      if (!("album" in current) || !current.album) return false;
      return item.item_id === current.album.item_id;
    }
    case "artists": {
      if (!("artists" in current) || !current.artists) return false;
      return (
        Array.isArray(current.artists) &&
        current.artists.some(
          (artist) => artist && artist.item_id === item.item_id,
        )
      );
    }
    case "radios": {
      return item.item_id === current.item_id;
    }
    case "podcasts": {
      if (!("podcast" in current) || !current.podcast) return false;
      return item.item_id === current.podcast.item_id;
    }
    case "podcastepisodes": {
      return item.item_id === current.item_id;
    }
    default: {
      return false;
    }
  }
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
  setItemsListingPreference(
    props.path || props.itemtype,
    props.itemtype,
    "sortBy",
    params.value.sortBy,
  );
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
  setItemsListingPreference(
    props.path || props.itemtype,
    props.itemtype,
    "albumType",
    params.value.albumType,
  );
  loadData(undefined, undefined, true);
};

const changeProviderFilter = function (providerId: string) {
  if (params.value.provider?.includes(providerId))
    params.value.provider = params.value.provider?.filter(
      (id) => id !== providerId,
    );
  else {
    params.value.provider = params.value.provider || [];
    params.value.provider.push(providerId);
  }
  // If the array is empty, set to undefined (show all)
  if (params.value.provider.length === 0) {
    params.value.provider = undefined;
  }
  setItemsListingPreference(
    props.path || props.itemtype,
    props.itemtype,
    "providerFilter",
    params.value.provider,
  );
  loadData(true, undefined, true);
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
  } else if (props.itemtype == "genres") {
    store.globalSearchType = MediaType.GENRE;
  }
  router.push({ name: "search" });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadNextPage = async function ({ done }: { done: any }) {
  if (allItemsReceived.value) {
    done("empty");
    return;
  }

  await loadData(
    undefined,
    undefined,
    undefined,
    params.value.offset + props.limit,
  );

  done("ok");
};

const loadAllItems = async function () {
  while (!allItemsReceived.value) {
    await loadNextPage({ done: function () {} });
  }
};

// computed properties
const isSearchActive = computed(() => {
  var searchActive = false;
  if (params.value.search && params.value.search.length !== 0) {
    searchActive = true;
  }
  return searchActive;
});

const showSearchInput = computed(() => {
  return showSearch.value && expanded.value;
});

const isLibraryItem = computed(() => {
  const libraryItemTypes = [
    "artists",
    "albums",
    "tracks",
    "playlists",
    "audiobooks",
    "podcasts",
    "radios",
    "genres",
  ];

  return libraryItemTypes.includes(props.itemtype);
});

const isPlayActionInProgress = computed(() => {
  if (!store.activePlayerQueue) return false;
  return (
    store.activePlayerQueue.extra_attributes?.play_action_in_progress === true
  );
});

const musicProviders = computed(() => {
  // Map itemtype to required ProviderFeature(s)
  const featureMap: Record<string, ProviderFeature | ProviderFeature[]> = {
    artists: ProviderFeature.LIBRARY_ARTISTS,
    albums: ProviderFeature.LIBRARY_ALBUMS,
    tracks: ProviderFeature.LIBRARY_TRACKS,
    artisttracks: [
      ProviderFeature.ARTIST_TOPTRACKS,
      ProviderFeature.LIBRARY_TRACKS,
    ],
    playlists: ProviderFeature.LIBRARY_PLAYLISTS,
    radios: ProviderFeature.LIBRARY_RADIOS,
    podcasts: ProviderFeature.LIBRARY_PODCASTS,
    audiobooks: ProviderFeature.LIBRARY_AUDIOBOOKS,
    genres: ProviderFeature.LIBRARY_GENRES,
  };

  const requiredFeatures = featureMap[props.itemtype];

  return Object.values(api.providers)
    .filter((provider) => {
      if (provider.type !== ProviderType.MUSIC) return false;
      if (
        store.currentUser &&
        store.currentUser.provider_filter.length &&
        !store.currentUser.provider_filter.includes(provider.instance_id)
      ) {
        // for non-admin users, the providerfilter is applied in the backend
        // but for admin users we need to filter here as well
        return false;
      }
      // If we have required feature(s) for this itemtype, filter by them
      if (requiredFeatures) {
        const features = Array.isArray(requiredFeatures)
          ? requiredFeatures
          : [requiredFeatures];
        return features.some((feature) =>
          provider.supported_features.includes(feature),
        );
      }
      // Otherwise, include all music providers
      return true;
    })
    .map((provider) => ({
      label: provider.name,
      value: provider.instance_id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
});

watchEffect(() => {
  if (!showSearchInput.value) {
    searchHasFocus.value = false;
  }
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
    if (showCheckboxes.value) {
      items.push({
        label: "tooltip.select_all",
        icon: "mdi-select-all",
        action: selectAll,
        overflowAllowed: true,
      });
    }
    items.push({
      label: "tooltip.select_items",
      icon: showCheckboxes.value
        ? "mdi-checkbox-multiple-outline"
        : "mdi-checkbox-multiple-blank-outline",
      action: toggleCheckboxes,
      active: showCheckboxes.value,
      overflowAllowed: true,
    });
  }
  // library only filter
  if (props.showLibraryOnlyFilter === true) {
    items.push({
      label: "tooltip.filter_library",
      icon: "mdi-bookshelf",
      action: toggleLibraryOnlyFilter,
      active: params.value.libraryOnly,
      overflowAllowed: true,
    });
  }

  // genre filter
  if (props.showGenreFilter === true && genreOptions.value.length > 0) {
    const current = params.value.genreIds;
    const activeIds = Array.isArray(current)
      ? current
      : typeof current === "number"
        ? [current]
        : [];
    items.push({
      label: "tooltip.filter_genre",
      icon: "mdi-tag-outline",
      disabled: loading.value,
      active: activeIds.length > 0,
      closeOnContentClick: false,
      overflowAllowed: true,
      subItems: genreOptions.value.map((genre) => {
        const selected = activeIds.includes(genre.value);
        return {
          label: genre.label,
          selected,
          action: () => toggleGenreFilter(genre.value),
        };
      }),
    });
  }

  // favorites only filter
  if (props.showFavoritesOnlyFilter === true) {
    items.push({
      label: "tooltip.filter_favorites",
      icon: params.value.favoritesOnly ? "mdi-heart" : "mdi-heart-outline",
      action: toggleFavoriteFilter,
      active: params.value.favoritesOnly,
      overflowAllowed: true,
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
      overflowAllowed: true,
    });
  }

  // has media mappings filter (hide empty genres)
  if (props.showHideEmptyFilter === true) {
    items.push({
      label: params.value.hideEmptyFilter
        ? "tooltip.show_empty_genres"
        : "tooltip.hide_empty_genres",
      icon: params.value.hideEmptyFilter
        ? "mdi-tag-check"
        : "mdi-tag-check-outline",
      action: toggleHideEmptyFilter,
      active: params.value.hideEmptyFilter,
      overflowAllowed: true,
    });
  }

  // album type filter
  if (props.showAlbumTypeFilter) {
    items.push({
      label: "tooltip.album_type",
      icon: "mdi-album",
      disabled: loading.value,
      active: params.value.albumType && params.value.albumType.length > 0,
      closeOnContentClick: false,
      overflowAllowed: true,
      subItems: [
        "album",
        "single",
        "ep",
        "compilation",
        "live",
        "soundtrack",
        "unknown",
      ].map((key) => {
        return {
          label: `album_type.${key}`,
          selected: params.value.albumType?.includes(key),
          action: () => {
            changeAlbumTypeFilter(key);
          },
        };
      }),
    });
  }

  // provider filter
  if (props.showProviderFilter && musicProviders.value.length > 1) {
    items.push({
      label: "tooltip.filter_provider",
      icon: "mdi-package-variant",
      disabled: loading.value,
      active: params.value.provider && params.value.provider.length > 0,
      closeOnContentClick: false,
      overflowAllowed: true,
      subItems: musicProviders.value.map((provider) => {
        return {
          label: provider.label,
          selected: params.value.provider?.includes(provider.value),
          action: () => {
            changeProviderFilter(provider.value);
          },
        };
      }),
    });
  }

  // refresh action
  if (
    props.showRefreshButton !== false ||
    (newContentAvailable.value && !props.refreshOnParentUpdate)
  ) {
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
      overflowAllowed: true,
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
      overflowAllowed: false,
    });
  }

  // toggle view mode
  items.push({
    label: "tooltip.toggle_view_mode",
    icon: viewMode.value == "list" ? "mdi-view-list" : "mdi-grid",
    overflowAllowed: true,
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

// Get preferences as a computed ref that updates automatically
const savedPrefs = getItemsListingPreferences(
  props.path || props.itemtype,
  props.itemtype,
);

const restoreSettings = async function () {
  // restore settings for this path/itemtype
  const prefs = savedPrefs.value;

  // get stored/default viewMode for this itemtype
  if (prefs.viewMode) {
    viewMode.value = prefs.viewMode;
  } else if (props.itemtype == "artists") {
    viewMode.value = "panel";
  } else if (props.itemtype == "albums") {
    viewMode.value = "panel";
  } else {
    viewMode.value = "list";
  }

  // get stored/default sortBy for this itemtype
  if (prefs.sortBy && props.sortKeys.includes(prefs.sortBy)) {
    params.value.sortBy = prefs.sortBy;
  } else {
    params.value.sortBy = props.sortKeys[0];
  }

  // get stored/default favoriteOnlyFilter for this itemtype
  if (props.showFavoritesOnlyFilter !== false && prefs.favoriteFilter) {
    params.value.favoritesOnly = prefs.favoriteFilter;
  }

  // get stored/default libraryOnlyFilter for this itemtype
  if (props.showLibraryOnlyFilter !== false && prefs.libraryFilter) {
    params.value.libraryOnly = prefs.libraryFilter;
  }

  // get stored/default albumArtistsOnlyFilter for this itemtype
  if (
    props.showAlbumArtistsOnlyFilter !== false &&
    prefs.albumArtistsFilter !== undefined
  ) {
    params.value.albumArtistsFilter = prefs.albumArtistsFilter;
  }

  // get stored/default hideEmptyFilter for this itemtype (default: on)
  if (props.showHideEmptyFilter) {
    params.value.hideEmptyFilter =
      prefs.hideEmptyFilter !== undefined ? prefs.hideEmptyFilter : true;
  }

  // get stored/default expand property for this itemtype
  if (props.allowCollapse !== false && prefs.expand !== undefined) {
    expanded.value = prefs.expand;
  }

  // get stored/default albumType filter for this itemtype
  if (props.showAlbumTypeFilter === true && prefs.albumType) {
    params.value.albumType = prefs.albumType;
  }

  // get stored/default provider filter for this itemtype
  if (props.showProviderFilter === true && prefs.providerFilter) {
    params.value.provider = prefs.providerFilter;
  }

  // get stored searchquery (but only if we're allowed to store the state)
  if (props.restoreState && prefs.search) {
    params.value.search = prefs.search;
  }
};

// lifecycle hooks
const keyListener = function (e: KeyboardEvent) {
  if (store.dialogActive) return;
  if (loading.value) return;
  if (e.key === "Escape") closeSearch();
  // Let searchInput handle this.
  if (searchHasFocus.value) return;

  if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    selectAll();
  } else if (!searchHasFocus.value && e.key == "Backspace") {
    focusSearch();
  } else if (!searchHasFocus.value && e.key.length == 1) {
    showSearch.value = true;
    focusSearch();
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
    const el = document.querySelector(".content-section");

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
    if (props.restoreState) {
      setItemsListingPreference(
        props.path || props.itemtype,
        props.itemtype,
        "search",
        params.value.search,
      );
    }
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
    if (props.refreshOnParentUpdate) {
      loadData(true);
    } else {
      allItems.value = [];
      newContentAvailable.value = true;
    }
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

// Watch savedPrefs and restore settings when they change (e.g., when user loads)
watch(savedPrefs, () => restoreSettings(), { immediate: true });

const loadGenreOptions = async () => {
  if (!props.showGenreFilter) return;

  try {
    const genres = await api.getLibraryGenres(
      undefined,
      undefined,
      100,
      0,
      "name",
    );

    genreOptions.value = genres.map((genre) => ({
      label: genre.name,
      value: Number(genre.item_id),
    }));
  } catch {
    toast.error(t("error_loading_genres"));
  }
};

let _unsubscribeMediaEvents: (() => void) | undefined;
onBeforeUnmount(() => {
  eventbus.off("clearSelection");
  _unsubscribeMediaEvents?.();
});

onMounted(async () => {
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
      const el = document.querySelector(".content-section") as HTMLElement;

      if (el) {
        scrollElement(el, store.prevState!.scrollPos, 50);
      }
    });
    loading.value = false;
    if (applyQueryGenreFilter()) {
      loadData(true, undefined, true);
    }
  } else {
    applyQueryGenreFilter();
    loadData(true);
  }

  await loadGenreOptions();

  // Listen for selection clearing events
  eventbus.on("clearSelection", () => {
    selectedItems.value = [];
    showCheckboxes.value = false;
  });

  // signal if/when items get played/updated/removed
  _unsubscribeMediaEvents = api.subscribe_multi(
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
});

watch(
  () => route.query,
  () => {
    if (applyQueryGenreFilter()) {
      loadData(true, undefined, true);
    }
  },
  { deep: true },
);

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
  if ("translation_key" in item && item.translation_key && item.name)
    return t(item.translation_key, [item.name]);
  if ("translation_key" in item && item.translation_key)
    return t(item.translation_key);
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
    result.sort((a, b) => {
      const aTimestamp = "timestamp_added" in a ? a.timestamp_added : 0;
      const bTimestamp = "timestamp_added" in b ? b.timestamp_added : 0;
      return bTimestamp - aTimestamp;
    });
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

const selectAll = async function () {
  let confirmed = true;
  // We use the total length even when searching, since we can't know
  // how many items will be loaded after filtering
  const itemCount = props.total || allItems.value.length;
  if (itemCount > 250) {
    // This could be a large selection. Prevent accidental activation
    // by asking the user for a confirmation
    confirmed = await new Promise((resolve) => {
      if (confirm(t("select_all_confirmation"))) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  }

  if (confirmed) {
    await loadAllItems();
    selectedItems.value = pagedItems.value;
    showCheckboxes.value = true;
  }
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
