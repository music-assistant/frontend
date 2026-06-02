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
      <!-- windowed letter-jump: spinner while the target page loads -->
      <div
        v-if="jumpLoading"
        style="
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 10;
        "
      >
        <v-progress-circular
          indeterminate
          color="primary"
          size="48"
          width="4"
        />
      </div>

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
            v-for="(item, index) in pagedItems"
            :key="item.uri"
            :data-listing-item="index"
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
              :sort-by="params.sortBy"
              @select="onSelect"
            />
          </v-col>
        </v-row>

        <!-- compact panel view -->
        <v-row v-if="viewMode == 'panel_compact'">
          <v-col
            v-for="(item, index) in pagedItems"
            :key="item.uri"
            :data-listing-item="index"
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
              :sort-by="params.sortBy"
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
          <template #default="{ item, index }">
            <div :data-listing-item="index">
              <!-- windowed mode: not-yet-loaded rows render as skeletons -->
              <ListViewSkeleton v-if="isPlaceholder(item)" />
              <ListviewItem
                v-else
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
                :sort-by="params.sortBy"
                @select="onSelect"
              />
            </div>
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

      <!-- alphabet quick-jump bar (only for alphabetical sorts) -->
      <AlphabetIndexBar
        v-if="showAlphabetBar"
        :letters="displayLetters"
        @jump="onLetterJump"
      />

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
                  true,
                  params.sortBy,
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
import GenreIcon from "@/components/icons/GenreIcon.vue";
import { Eye, EyeClosed, Layers } from "lucide-vue-next";
import ListViewSkeleton from "@/components/skeletons/ListViewSkeleton.vue";
import PanelViewSkeleton from "@/components/skeletons/PanelViewSkeleton.vue";
import AlphabetIndexBar from "@/components/AlphabetIndexBar.vue";
import Toolbar, { ToolBarMenuItem } from "@/components/Toolbar.vue";
import { useUserPreferences } from "@/composables/userPreferences";
import {
  getGenreDisplayName,
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
  LetterIndexBucket,
  LibraryLetterIndex,
  MediaItemTypeOrItemMapping,
  MediaType,
  PlaybackState,
  PodcastEpisode,
  ProviderFeature,
  ProviderType,
  Radio,
  type Album,
  type Genre,
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
  hideEmptyFilter?: boolean | null;
  hideFullyPlayed?: boolean;
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
  showHideFullyPlayedFilter?: boolean;
  allowCollapse?: boolean;
  allowKeyHooks?: boolean;
  extraMenuItems?: ToolBarMenuItem[];
  // loadPagedData callback is provided for serverside paging/sorting
  loadPagedData?: (params: LoadDataParams) => Promise<MediaItemType[]>;
  // loadItems callback is provided for flat non-paged listings
  loadItems?: (params: LoadDataParams) => Promise<MediaItemType[]>;
  // loadLetterIndex callback enables the A-Z quick-jump bar (alphabetical sorts)
  loadLetterIndex?: (params: LoadDataParams) => Promise<LibraryLetterIndex>;
  // windowed enables lazy/windowed loading (list view, alphabetical sorts) so a
  // far letter-jump only loads the visible window instead of every row above it
  windowed?: boolean;
  limit?: number;
  total?: number;
  infiniteScroll?: boolean;
  path?: string;
  icon?: string | Component;
  restoreState?: boolean;
  onTitleClick?: () => void;
  refreshOnParentUpdate?: boolean;
  forcedViewMode?: "list" | "panel" | "panel_compact";
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
  showHideFullyPlayedFilter: false,
  extraMenuItems: undefined,
  loadPagedData: undefined,
  loadItems: undefined,
  loadLetterIndex: undefined,
  windowed: false,
  path: undefined,
  icon: undefined,
  restoreState: false,
  onTitleClick: undefined,
  refreshOnParentUpdate: false,
  forcedViewMode: undefined,
});

// global refs
const router = useRouter();
const route = useRoute();
const { t, te } = useI18n();
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

// alphabet quick-jump state
const ALPHA_SORTS = ["name", "sort_name"];
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const letterBuckets = ref<LetterIndexBucket[]>([]);
// total item count the current index was computed against (needed to convert
// the server's always-ascending offsets into descending display positions)
const letterTotal = ref(0);
// signature of the params the current letterBuckets were fetched for, so we
// only refetch when something that affects the index actually changes
let letterIndexSignature = "";
let letterIndexToken = 0;

const baseSortKey = computed(() => params.value.sortBy.replace(/_desc$/, ""));
const isAlphaSort = computed(() => ALPHA_SORTS.includes(baseSortKey.value));
const isDescendingSort = computed(() => params.value.sortBy.endsWith("_desc"));
const showAlphabetBar = computed(
  () =>
    isAlphaSort.value &&
    !!props.loadLetterIndex &&
    !params.value.search &&
    letterBuckets.value.length > 1,
);

// server offsets are always ascending; pair each bucket with the next bucket's
// offset (its ascending "end") so we can derive descending positions too
const ascBuckets = computed(() => {
  const sorted = [...letterBuckets.value].sort((a, b) => a.offset - b.offset);
  return sorted.map((b, i) => ({
    label: b.label,
    start: b.offset,
    end: i + 1 < sorted.length ? sorted[i + 1].offset : letterTotal.value,
  }));
});

// map of letter -> target row index in the *displayed* (current sort) order
const labelTargets = computed(() => {
  const m = new Map<string, number>();
  for (const b of ascBuckets.value) {
    // descending: the bucket's first displayed row is total - itsAscendingEnd
    const target = isDescendingSort.value ? letterTotal.value - b.end : b.start;
    m.set(b.label, Math.max(0, target));
  }
  return m;
});

// full A-Z (+ optional #) in display order, flagged with availability so empty
// letters render dimmed but remain clickable (they snap to the nearest letter)
const displayLetters = computed(() => {
  const hasHash = labelTargets.value.has("#");
  const letters = isDescendingSort.value ? [...ALPHABET].reverse() : ALPHABET;
  const result: { label: string; available: boolean }[] = [];
  // "#" (non-alphabetic) sorts at the top ascending / bottom descending
  if (hasHash && !isDescendingSort.value)
    result.push({ label: "#", available: true });
  for (const l of letters)
    result.push({ label: l, available: labelTargets.value.has(l) });
  if (hasHash && isDescendingSort.value)
    result.push({ label: "#", available: true });
  return result;
});

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
  const crossedWindowedBoundary =
    props.windowed && (viewMode.value === "list") !== (newMode === "list");
  viewMode.value = newMode;
  if (!props.forcedViewMode) {
    setItemsListingPreference(
      props.path || props.itemtype,
      props.itemtype,
      "viewMode",
      newMode,
    );
  }
  // windowed mode is list-only; rebuild the data model when toggling in/out of
  // list view so we switch between the sparse window and the contiguous list
  if (crossedWindowedBoundary) loadData(true);
};

watch(
  () => props.forcedViewMode,
  (newMode) => {
    if (newMode) viewMode.value = newMode;
  },
);

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

const toggleHideFullyPlayedFilter = function () {
  params.value.hideFullyPlayed = !params.value.hideFullyPlayed;
  setItemsListingPreference(
    props.path || props.itemtype,
    props.itemtype,
    "hideFullyPlayedFilter",
    params.value.hideFullyPlayed,
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
  const current = params.value.hideEmptyFilter;
  // cycle: undefined/false (all) → true (hide empty) → null (defaults only) → false (all)
  if (current === true) {
    params.value.hideEmptyFilter = null;
  } else if (current === null) {
    params.value.hideEmptyFilter = false;
  } else {
    params.value.hideEmptyFilter = true;
  }
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

const loadNextPage = async function ({
  done,
}: {
  done: (status: "ok" | "empty" | "loading" | "error") => void;
}) {
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

// build a signature for the params that influence the letter index, so we can
// skip refetching when only the offset (scroll position) changed
const letterIndexParamsSignature = function () {
  const p = params.value;
  return JSON.stringify([
    p.sortBy,
    p.favoritesOnly || false,
    p.albumArtistsFilter || false,
    p.albumType || null,
    p.provider || null,
    p.genreIds ?? null,
  ]);
};

// (re)load the alphabet quick-jump index when an alphabetical sort is active
const loadLetterIndex = async function () {
  if (!props.loadLetterIndex || !isAlphaSort.value || params.value.search) {
    letterBuckets.value = [];
    letterIndexSignature = "";
    if (windowedActive.value) teardownWindowed();
    return;
  }
  const signature = letterIndexParamsSignature();
  if (signature === letterIndexSignature) {
    syncWindowed();
    return;
  }
  const token = ++letterIndexToken;
  try {
    const result = await props.loadLetterIndex(params.value);
    // ignore stale responses if params changed while we were waiting
    if (token !== letterIndexToken) return;
    letterBuckets.value = result.buckets || [];
    letterTotal.value = result.total || 0;
    letterIndexSignature = signature;
    syncWindowed();
  } catch {
    if (token !== letterIndexToken) return;
    letterBuckets.value = [];
    letterTotal.value = 0;
    letterIndexSignature = "";
    if (windowedActive.value) teardownWindowed();
  }
};

// resolve a tapped letter to the nearest available one and jump there.
// empty letters snap forward (down the bar) to the next available letter, or
// back to the last available letter if there is none after it.
const onLetterJump = function (label: string) {
  const list = displayLetters.value;
  const idx = list.findIndex((e) => e.label === label);
  if (idx < 0) return;
  for (let i = idx; i < list.length; i++) {
    if (list[i].available)
      return jumpToIndex(labelTargets.value.get(list[i].label)!);
  }
  for (let i = idx - 1; i >= 0; i--) {
    if (list[i].available)
      return jumpToIndex(labelTargets.value.get(list[i].label)!);
  }
};

const offsetWithin = function (el: HTMLElement, container: HTMLElement) {
  return (
    el.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop
  );
};

// wait a couple of animation frames so the virtual scroller can render the
// rows around a newly-set scroll position
const waitFrames = function (frames: number) {
  return new Promise<void>((resolve) => {
    const step = (n: number) =>
      n <= 0 ? resolve() : requestAnimationFrame(() => step(n - 1));
    step(frames);
  });
};

const renderedRow = function (content: HTMLElement, index: number) {
  return content.querySelector(
    `[data-listing-item="${index}"]`,
  ) as HTMLElement | null;
};

// run async tasks with a bounded number running at once (keeps load gentle on
// low-power servers like a Raspberry Pi). Results preserve task order.
const runPool = async function <T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
) {
  const results = new Array<T>(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const cur = next++;
      results[cur] = await tasks[cur]();
    }
  };
  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    worker,
  );
  await Promise.all(workers);
  return results;
};

// max simultaneous page requests when bulk-loading toward a jump target
const JUMP_MAX_PARALLEL = 3;

// page items in until the given index is loaded. The virtual list needs a
// contiguous array from 0, so reaching a far letter (e.g. Z in a 4500-item
// library) would otherwise mean ~90 sequential 50-item requests (the scrollbar
// slowly creeping). For server-paged listings we fetch the gap in parallel
// (bounded concurrency): one request first to discover the server's effective
// page size, then the remaining offsets in parallel waves so the data stays
// contiguous even if the server caps the page limit.
const ensurePagedTo = async function (index: number) {
  if (pagedItems.value.length > index || allItemsReceived.value) return;

  if (props.loadPagedData) {
    // wait out any in-flight load to avoid racing the infinite scroller
    let guard = 0;
    while (loading.value && guard < 100) {
      await waitFrames(2);
      guard++;
    }
    if (pagedItems.value.length > index || allItemsReceived.value) return;

    loading.value = true;
    try {
      const total = letterTotal.value || props.total || 0;
      const needTo = total
        ? Math.min(index + 20, Math.max(0, total - 1))
        : index + 20;

      // 1) one request to discover the server's effective page size
      const first = await props.loadPagedData({
        ...params.value,
        offset: pagedItems.value.length,
        limit: Math.max(props.limit, 1000),
      });
      if (first.length) pagedItems.value.push(...first);
      const step = first.length;

      // 2) fetch the remaining offsets in parallel using that page size
      if (
        step > 0 &&
        pagedItems.value.length <= needTo &&
        !(total && pagedItems.value.length >= total)
      ) {
        const offsets: number[] = [];
        for (let o = pagedItems.value.length; o <= needTo; o += step)
          offsets.push(o);
        const tasks = offsets.map(
          (o) => () =>
            props.loadPagedData!({ ...params.value, offset: o, limit: step }),
        );
        const chunks = await runPool(tasks, JUMP_MAX_PARALLEL);
        // append in order; once a chunk is short the rest are empty (skipped)
        for (const c of chunks) if (c.length) pagedItems.value.push(...c);
      }

      if (total && pagedItems.value.length >= total)
        allItemsReceived.value = true;
      else if (step === 0) allItemsReceived.value = true;

      // keep infinite-scroll bookkeeping consistent for later scrolling
      params.value.offset = Math.max(0, pagedItems.value.length - props.limit);
      params.value.limit = props.limit;
    } finally {
      loading.value = false;
    }
    return;
  }

  // non-paged (loadItems) listings already hold everything client-side; just
  // page the in-memory slices incrementally, guarding against a stall.
  let stalled = 0;
  while (
    pagedItems.value.length <= index &&
    !allItemsReceived.value &&
    stalled < 100
  ) {
    const before = pagedItems.value.length;
    if (loading.value) await waitFrames(2);
    else await loadNextPage({ done: function () {} });
    if (pagedItems.value.length === before) stalled++;
    else stalled = 0;
  }
};

// jump the listing so the item at the given (display-order) index sits at the
// top of the viewport. The list is virtualized with *measured* (not fixed) row
// heights, so a plain index*70 estimate drifts further down the list. Instead
// we home in: estimate -> render -> measure real row height -> re-estimate,
// then land exactly on the measured row position once it is rendered.
const jumpToIndex = async function (displayIndex: number) {
  // make sure the target row is loaded. In windowed mode the array is already
  // full-length with placeholders, so we kick off the (background) fetch for
  // the target page and scroll straight away - the row shows a skeleton with a
  // spinner until the data arrives. Otherwise page in everything up to it.
  if (windowedActive.value) {
    jumpLoading.value = true;
    ensureWindowForIndex(displayIndex).finally(() => {
      jumpLoading.value = false;
    });
  } else {
    await ensurePagedTo(displayIndex);
  }
  const targetIndex = Math.min(displayIndex, pagedItems.value.length - 1);
  if (targetIndex < 0) return;

  const content = document.querySelector(".content-section") as HTMLElement;
  if (!content) return;

  // panel/compact modes render every item, so the target is always in the DOM
  if (viewMode.value !== "list") {
    await nextTick();
    const el = renderedRow(content, targetIndex);
    if (el) scrollElement(content, offsetWithin(el, content), 200);
    return;
  }

  const listEl = content.querySelector(
    ".v-virtual-scroll",
  ) as HTMLElement | null;
  const base = listEl ? offsetWithin(listEl, content) : 0;
  let rowH = 70; // initial estimate, refined from real rows below

  for (let attempt = 0; attempt < 8; attempt++) {
    const target = renderedRow(content, targetIndex);
    if (target) {
      // target is rendered - land exactly on its measured position
      scrollElement(content, offsetWithin(target, content), 150);
      return;
    }
    // refine the row height from whatever rows are currently rendered, then
    // jump close to the target using a known rendered row as the anchor
    const rendered = content.querySelectorAll("[data-listing-item]");
    if (rendered.length >= 2) {
      const first = rendered[0] as HTMLElement;
      const last = rendered[rendered.length - 1] as HTMLElement;
      const i0 = Number(first.getAttribute("data-listing-item"));
      const i1 = Number(last.getAttribute("data-listing-item"));
      if (i1 > i0) {
        rowH =
          (offsetWithin(last, content) - offsetWithin(first, content)) /
          (i1 - i0);
        content.scrollTop =
          offsetWithin(first, content) + (targetIndex - i0) * rowH;
      } else {
        content.scrollTop = base + targetIndex * rowH;
      }
    } else {
      content.scrollTop = base + targetIndex * rowH;
    }
    await nextTick();
    await waitFrames(2);
  }
};

// ---------------------------------------------------------------------------
// Windowed / lazy loading (opt-in via the `windowed` prop, list view only).
//
// Instead of loading a contiguous array from row 0 up to the target (which on
// large libraries means loading thousands of full objects), we size the array
// to the full `total` with cheap placeholder rows and only fetch the page(s)
// around what's visible. A far letter-jump then loads just one small page.
// Tied to the letter-index `total` (computed with the same filters as the
// list), and only active for alphabetical sorts without a search filter - which
// is exactly when the quick-jump bar is shown.
// ---------------------------------------------------------------------------
const windowedActive = ref(false);
// true while a letter-jump is waiting for its target page to load (drives a
// loading spinner so the jump doesn't look frozen)
const jumpLoading = ref(false);
const loadedPages = new Set<number>();
const loadingPages = new Set<number>();
let windowScrollEl: HTMLElement | null = null;
let windowScrollScheduled = false;

// Windowing builds a full-length virtual list (one row per item in the whole
// library). On desktop that's fine, but on iOS/iPadOS Safari the resulting
// scroll layer (millions of pixels tall for a large library) exhausts memory
// and crashes the whole tab. Lightening the rows didn't help - it's the size
// of the layer itself - so we keep windowing off for touch (coarse-pointer)
// devices, which fall back to the regular infinite-scroll path.
const supportsWindowing =
  typeof window === "undefined" ||
  !window.matchMedia ||
  !window.matchMedia("(pointer: coarse)").matches;

const isPlaceholder = function (item: unknown) {
  // unloaded rows are stored as null (kept lightweight - allocating an object
  // per row freezes iOS Safari on large libraries)
  return item == null;
};

const makePlaceholders = function (count: number) {
  return Array.from(
    { length: count },
    () => null,
  ) as unknown as MediaItemType[];
};

const windowConditionsMet = function () {
  return (
    props.windowed &&
    supportsWindowing &&
    !!props.loadPagedData &&
    viewMode.value === "list" &&
    isAlphaSort.value &&
    !params.value.search &&
    (letterTotal.value || 0) > 0
  );
};

// fetch a single page and splice the real items into the sparse array
const loadWindowPage = async function (pageIndex: number) {
  const ps = props.limit;
  if (pageIndex < 0) return;
  const offset = pageIndex * ps;
  if (offset >= pagedItems.value.length) return;
  if (loadedPages.has(pageIndex) || loadingPages.has(pageIndex)) return;
  loadingPages.add(pageIndex);
  try {
    const items = await props.loadPagedData!({
      ...params.value,
      offset,
      limit: ps,
    });
    // splice the whole page in one go - a single reactive update (and so one
    // virtual-list recompute) instead of one per row, which matters on iOS
    const count = Math.min(items.length, pagedItems.value.length - offset);
    if (count > 0)
      pagedItems.value.splice(offset, count, ...items.slice(0, count));
    loadedPages.add(pageIndex);
  } finally {
    loadingPages.delete(pageIndex);
  }
};

// ensure the page containing the given row (and its neighbours) is loaded
const ensureWindowForIndex = async function (index: number) {
  const ps = props.limit;
  const page = Math.floor(index / ps);
  await Promise.all([page - 1, page, page + 1].map((p) => loadWindowPage(p)));
};

// load whichever pages are currently scrolled into view (plus a buffer)
const loadVisibleWindow = function () {
  if (!windowedActive.value) return;
  const content = windowScrollEl;
  if (!content) return;
  const listEl = content.querySelector(
    ".v-virtual-scroll",
  ) as HTMLElement | null;
  const listTop = listEl ? offsetWithin(listEl, content) : 0;
  // estimate row height from a rendered row, fall back to the item-height
  let rowH = 70;
  const rendered = content.querySelectorAll("[data-listing-item]");
  if (rendered.length >= 2) {
    const a = rendered[0] as HTMLElement;
    const b = rendered[rendered.length - 1] as HTMLElement;
    const ia = Number(a.getAttribute("data-listing-item"));
    const ib = Number(b.getAttribute("data-listing-item"));
    if (ib > ia)
      rowH = (offsetWithin(b, content) - offsetWithin(a, content)) / (ib - ia);
  }
  const top = content.scrollTop - listTop;
  const first = Math.floor(top / rowH);
  const last = Math.ceil((top + content.clientHeight) / rowH);
  const ps = props.limit;
  const startPage = Math.max(0, Math.floor(first / ps) - 1);
  const endPage = Math.floor(last / ps) + 1;
  for (let p = startPage; p <= endPage; p++) loadWindowPage(p);
};

const onWindowScroll = function () {
  if (windowScrollScheduled) return;
  windowScrollScheduled = true;
  requestAnimationFrame(() => {
    windowScrollScheduled = false;
    loadVisibleWindow();
  });
};

const attachWindowScroll = function () {
  if (windowScrollEl) return;
  const el = document.querySelector(".content-section") as HTMLElement | null;
  if (!el) return;
  windowScrollEl = el;
  el.addEventListener("scroll", onWindowScroll, { passive: true });
};

const detachWindowScroll = function () {
  if (windowScrollEl) {
    windowScrollEl.removeEventListener("scroll", onWindowScroll);
    windowScrollEl = null;
  }
};

// turn the freshly-loaded contiguous list into a sparse, full-length window
const upgradeToWindowed = function () {
  if (windowedActive.value || !windowConditionsMet()) return;
  const total = letterTotal.value;
  const loaded = pagedItems.value;
  const arr = makePlaceholders(total);
  for (let i = 0; i < loaded.length && i < total; i++) arr[i] = loaded[i];
  pagedItems.value = arr;
  loadedPages.clear();
  loadingPages.clear();
  const pages = Math.ceil(Math.min(loaded.length, total) / props.limit);
  for (let p = 0; p < pages; p++) loadedPages.add(p);
  // stop the infinite-scroller; the window handler drives loading from here
  allItemsReceived.value = true;
  windowedActive.value = true;
  attachWindowScroll();
  nextTick(loadVisibleWindow);
};

const teardownWindowed = function () {
  windowedActive.value = false;
  loadedPages.clear();
  loadingPages.clear();
  detachWindowScroll();
};

// activate or deactivate windowed mode to match the current conditions
const syncWindowed = function () {
  if (windowConditionsMet()) {
    if (!windowedActive.value) upgradeToWindowed();
  } else if (windowedActive.value) {
    teardownWindowed();
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
      icon: GenreIcon,
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

  // hide fully played filter (e.g. podcast episodes)
  if (props.showHideFullyPlayedFilter === true) {
    items.push({
      label: "tooltip.filter_hide_fully_played",
      icon: params.value.hideFullyPlayed
        ? "mdi-eye-off"
        : "mdi-eye-off-outline",
      action: toggleHideFullyPlayedFilter,
      active: params.value.hideFullyPlayed,
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

  // has media mappings filter (hide empty genres / show only defaults)
  if (props.showHideEmptyFilter === true) {
    const hef = params.value.hideEmptyFilter;
    items.push({
      label:
        hef === true
          ? "tooltip.show_only_default_genres"
          : hef === null
            ? "tooltip.show_all_genres"
            : "tooltip.hide_empty_genres",
      icon: hef === true ? EyeClosed : hef === null ? Layers : Eye,
      action: toggleHideEmptyFilter,
      active: hef === true || hef === null,
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

  // toggle view mode (hidden when view mode is controlled externally)
  if (!props.forcedViewMode)
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
    // drop any windowed state; it is re-established after the letter index loads
    if (windowedActive.value) teardownWindowed();
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

  // refresh the alphabet quick-jump index on a full (re)load, not on paging
  if (!offset) {
    loadLetterIndex();
  }
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
  if (props.forcedViewMode) {
    viewMode.value = props.forcedViewMode;
  } else if (prefs.viewMode) {
    viewMode.value = prefs.viewMode;
  } else if (
    props.itemtype == "artists" ||
    props.itemtype == "similarartists"
  ) {
    viewMode.value = "panel";
  } else if (props.itemtype == "albums") {
    viewMode.value = "panel";
  } else if (props.itemtype == "genres") {
    viewMode.value = "panel_compact";
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

  if (props.showHideFullyPlayedFilter === true && prefs.hideFullyPlayedFilter) {
    params.value.hideFullyPlayed = prefs.hideFullyPlayedFilter;
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

  // get stored/default hideEmptyFilter for this itemtype (default: true = hide empty)
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
  // only apply stored filter if there are multiple providers available
  // with a single provider, any stored filter is either redundant or stale
  if (
    props.showProviderFilter === true &&
    prefs.providerFilter &&
    musicProviders.value.length > 1
  ) {
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
      windowedActive: windowedActive.value,
      loadedPages: Array.from(loadedPages),
      letterBuckets: letterBuckets.value,
      letterTotal: letterTotal.value,
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

const itemtypeToMediaType: Partial<Record<string, MediaType>> = {
  tracks: MediaType.TRACK,
  albums: MediaType.ALBUM,
  artists: MediaType.ARTIST,
  playlists: MediaType.PLAYLIST,
  audiobooks: MediaType.AUDIOBOOK,
  podcasts: MediaType.PODCAST,
};

const loadGenreOptions = async () => {
  if (!props.showGenreFilter) return;

  try {
    const pageSize = 100;
    const all: { label: string; value: number }[] = [];
    let offset = 0;
    let page: Genre[];
    const mediaType = itemtypeToMediaType[props.itemtype];

    do {
      page = await api.getLibraryGenres({
        limit: pageSize,
        offset,
        order_by: "name",
        hide_empty: true, // always hide empty genres in the filter dropdown
        media_type: mediaType, // filter to genres relevant for this media type
      });
      for (const genre of page) {
        all.push({
          label: getGenreDisplayName(genre.name, genre.translation_key, t, te),
          value: Number(genre.item_id),
        });
      }
      offset += pageSize;
    } while (page.length === pageSize);

    genreOptions.value = all;
  } catch {
    toast.error(t("error_loading_genres"));
  }
};

let _unsubscribeMediaEvents: (() => void) | undefined;
onBeforeUnmount(() => {
  eventbus.off("clearSelection");
  _unsubscribeMediaEvents?.();
  detachWindowScroll();
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
    // restore windowed state (sparse array + which pages were loaded)
    if (store.prevState.windowedActive) {
      letterBuckets.value = store.prevState.letterBuckets || [];
      letterTotal.value = store.prevState.letterTotal || 0;
      letterIndexSignature = letterIndexParamsSignature();
      loadedPages.clear();
      for (const p of store.prevState.loadedPages || []) loadedPages.add(p);
      windowedActive.value = true;
      attachWindowScroll();
      nextTick(loadVisibleWindow);
    }
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
          (i) => i?.uri != evt.object_id,
        );
      } else if (evt.event == EventType.MEDIA_ITEM_UPDATED) {
        // update item
        const idx = pagedItems.value.findIndex((i) => i?.uri == evt.object_id);
        if (idx >= 0) {
          pagedItems.value[idx] = evt.data as MediaItemType;
        }
      } else if (evt.event == EventType.MEDIA_ITEM_PLAYED) {
        // update item
        const idx = pagedItems.value.findIndex((i) => i?.uri == evt.object_id);
        if (idx >= 0) {
          const playData = evt.data as Record<string, unknown>;
          if ("fully_played" in pagedItems.value[idx])
            pagedItems.value[idx].fully_played = playData[
              "fully_played"
            ] as boolean;
          if ("resume_position_ms" in pagedItems.value[idx])
            pagedItems.value[idx].resume_position_ms =
              (playData["seconds_played"] as number) * 1000;
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
  windowedActive?: boolean;
  loadedPages?: number[];
  letterBuckets?: LetterIndexBucket[];
  letterTotal?: number;
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

  if (params.sortBy == "album" || params.sortBy == "album_sort_name") {
    const preferSortName = params.sortBy == "album_sort_name";
    result.sort((a, b) => {
      const albumCompare = getSortName(
        (a as Track).album,
        preferSortName,
      ).localeCompare(
        getSortName((b as Track).album, preferSortName),
        undefined,
        { numeric: true },
      );
      if (albumCompare !== 0) return albumCompare;
      const discCompare =
        ((a as Track).disc_number ?? 0) - ((b as Track).disc_number ?? 0);
      if (discCompare !== 0) return discCompare;
      return (
        ((a as Track).track_number ?? 0) - ((b as Track).track_number ?? 0)
      );
    });
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

  if (params.hideFullyPlayed) {
    result = result.filter((x) => (x as PodcastEpisode).fully_played !== true);
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
    // in windowed mode the array contains placeholders for unloaded rows; only
    // select the rows actually loaded
    selectedItems.value = windowedActive.value
      ? pagedItems.value.filter((i) => !isPlaceholder(i))
      : pagedItems.value;
    showCheckboxes.value = true;
  }
};

defineExpose({
  sortBy: computed(() => params.value.sortBy),
  reload: () => loadData(true, true),
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
.col-10 {
  width: 10%;
  max-width: 10%;
  flex-basis: 10%;
  padding: 8px;
}
</style>
