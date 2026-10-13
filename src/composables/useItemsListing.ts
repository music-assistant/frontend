import { computed, onScopeDispose, ref } from "vue";

import { favoriteState } from "@/helpers/favorites";
import { useLibrarySorting } from "@/composables/useLibrarySorting";
import {
  Album,
  ListingType,
  MediaItem,
  MediaItemType,
  MediaItemTypeOrItemMapping,
  MediaType,
  PodcastEpisode,
  ProviderInstance,
  SortDirection,
  SortField,
  SortOptionInfo,
  Track,
} from "@/plugins/api/interfaces";

export type LoadPagedDataFn = (
  params: LoadDataParams,
) => Promise<MediaItemType[]>;

export interface ToolBarTab {
  id: string;
  label: string;
  loadPagedData?: LoadPagedDataFn;
}

export interface LoadDataParams {
  offset: number;
  limit: number;
  sortBy: string;
  sortField?: SortField;
  sortDirection?: SortDirection;
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
  collapseCollections?: boolean;
}

export interface StoredState {
  path: string;
  parentUri?: string;
  carried: boolean;
  scrollPos: number;
  pagedItems: MediaItemType[];
  allItems: MediaItemType[];
  allItemsReceived: boolean;
  initialDataReceived: boolean;
  params: LoadDataParams;
}

interface ItemsListingDataOptions {
  sortListing?: ListingType;
  sortOptionExcludeFields?: SortField[];
  loadPagedData?: LoadPagedDataFn;
  loadItems?: (params: LoadDataParams) => Promise<MediaItemType[]>;
  limit?: number;
  toolBarTabs?: ToolBarTab[];
  itemtype: string;
}

function getSortName(
  item: MediaItemType | MediaItemTypeOrItemMapping | null | undefined,
  preferSortName = false,
) {
  if (!item) return "";
  if (preferSortName && "sort_name" in item && item.sort_name) {
    return item.sort_name;
  }
  return item.name;
}

function getDateAdded(item: MediaItemType): number {
  const dateAdded = (item as MediaItem).date_added;
  const time = dateAdded ? Date.parse(dateAdded) : 0;
  return Number.isNaN(time) ? 0 : time;
}

function getFilteredItems(
  items: MediaItemType[],
  params: LoadDataParams,
): MediaItemType[] {
  let result: MediaItemType[];

  if (params.search) {
    const searchString = params.search.toLowerCase();
    result = items.filter((item) => {
      if (item.name.toLowerCase().includes(searchString)) return true;
      if (
        "album" in item &&
        item.album?.name.toLowerCase().includes(searchString)
      ) {
        return true;
      }
      return Boolean(
        "artists" in item &&
        item.artists?.length &&
        item.artists[0].name.toLowerCase().includes(searchString),
      );
    });
  } else {
    result = [...items];
  }

  if (params.sortBy === "name") {
    result.sort((a, b) =>
      getSortName(a).localeCompare(getSortName(b), undefined, {
        numeric: true,
      }),
    );
  }
  if (params.sortBy === "sort_name") {
    result.sort((a, b) =>
      getSortName(a, true).localeCompare(getSortName(b, true), undefined, {
        numeric: true,
      }),
    );
  }
  if (params.sortBy === "name_desc") {
    result.sort((a, b) =>
      getSortName(b).localeCompare(getSortName(a), undefined, {
        numeric: true,
      }),
    );
  }
  if (params.sortBy === "sort_name_desc") {
    result.sort((a, b) =>
      getSortName(b, true).localeCompare(getSortName(a, true), undefined, {
        numeric: true,
      }),
    );
  }

  if (params.sortBy === "album" || params.sortBy === "album_sort_name") {
    const preferSortName = params.sortBy === "album_sort_name";
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
  if (params.sortBy === "artist") {
    result.sort((a, b) =>
      getSortName((a as Track).artists[0]).localeCompare(
        getSortName((b as Track).artists[0]),
      ),
    );
  }
  if (params.sortBy === "track_number") {
    result.sort(
      (a, b) =>
        ((a as Track).track_number || 0) - ((b as Track).track_number || 0),
    );
    result.sort(
      (a, b) =>
        ((a as Track).disc_number || 0) - ((b as Track).disc_number || 0),
    );
  }
  if (params.sortBy === "position") {
    result.sort(
      (a, b) => ((a as Track).position || 0) - ((b as Track).position || 0),
    );
  }
  if (params.sortBy === "position_desc") {
    result.sort(
      (a, b) => ((b as Track).position || 0) - ((a as Track).position || 0),
    );
  }
  if (params.sortBy === "timestamp_added") {
    result.sort((a, b) => getDateAdded(a) - getDateAdded(b));
  }
  if (params.sortBy === "timestamp_added_desc") {
    result.sort((a, b) => getDateAdded(b) - getDateAdded(a));
  }
  if (params.sortBy === "year") {
    result.sort((a, b) => ((a as Album).year || 0) - ((b as Album).year || 0));
  }
  if (params.sortBy === "year_desc") {
    result.sort((a, b) => ((b as Album).year || 0) - ((a as Album).year || 0));
  }
  if (params.sortBy === "duration") {
    result.sort(
      (a, b) => ((a as Track).duration || 0) - ((b as Track).duration || 0),
    );
  }
  if (params.sortBy === "duration_desc") {
    result.sort(
      (a, b) => ((b as Track).duration || 0) - ((a as Track).duration || 0),
    );
  }
  if (params.sortBy === "provider") {
    result.sort((a, b) => a.provider.localeCompare(b.provider));
  }

  if (params.favoritesOnly) {
    result = result.filter((item) => favoriteState(item) === true);
  }
  if (params.hideFullyPlayed) {
    result = result.filter(
      (item) => (item as PodcastEpisode).fully_played !== true,
    );
  }
  if (params.albumType?.length) {
    result = result.filter((item) =>
      params.albumType?.includes((item as Album).album_type),
    );
  }
  return result.slice(params.offset, params.offset + params.limit);
}

export function useItemsListing(
  props: Readonly<ItemsListingDataOptions>,
  getActiveTab: () => ToolBarTab | undefined,
) {
  const params = ref<LoadDataParams>({
    offset: 0,
    limit: props.limit ?? 50,
    sortBy: "name",
    search: "",
    libraryOnly: false,
    genreIds: undefined,
  });
  const pagedItems = ref<MediaItemType[]>([]);
  const allItems = ref<MediaItemType[]>([]);
  const loading = ref(false);
  const newContentAvailable = ref(false);
  const allItemsReceived = ref(false);
  const loadError = ref(false);
  const initialDataReceived = ref(false);
  const tempHide = ref(false);
  const serverSortOptions = ref<SortOptionInfo[]>([]);
  const sortOptionsLoaded = ref(false);
  const sortOptions = computed(() =>
    serverSortOptions.value.filter(
      (option) =>
        !(props.sortOptionExcludeFields ?? []).includes(option.field) &&
        !(
          props.sortListing &&
          props.loadPagedData &&
          (option.field === SortField.RANDOM ||
            option.field === SortField.RANDOM_PLAY_COUNT)
        ),
    ),
  );
  const librarySorting = useLibrarySorting(
    sortOptions,
    computed(() => params.value.sortBy),
  );

  let loadingTabId: string | undefined;
  let pendingTabLoad = false;
  let pendingSortReload = false;
  let disposed = false;

  onScopeDispose(() => {
    disposed = true;
  });

  const scheduleSortReload = () => {
    pendingSortReload = true;
  };

  const loadData = async function (
    clear = false,
    refresh = false,
    filterParamsChanged = false,
    offset = 0,
  ) {
    let loadPagedData = props.loadPagedData;
    if (props.toolBarTabs?.length) {
      const activeTab = getActiveTab();
      if (activeTab?.loadPagedData) loadPagedData = activeTab.loadPagedData;
    }
    const currentTabId = props.toolBarTabs?.length
      ? getActiveTab()?.id
      : undefined;
    if (loading.value) {
      pendingTabLoad = currentTabId !== loadingTabId;
      if (filterParamsChanged) pendingSortReload = true;
      return;
    }
    loading.value = true;
    loadingTabId = currentTabId;
    if (clear || refresh || filterParamsChanged) loadError.value = false;
    if (filterParamsChanged && loadPagedData) clear = true;

    if (clear || refresh) {
      offset = 0;
      if (allItemsReceived.value) tempHide.value = true;
      allItemsReceived.value = false;
      initialDataReceived.value = false;
      newContentAvailable.value = false;
    }

    const previousOffset = params.value.offset;
    try {
      params.value.offset = offset;
      params.value.limit = props.limit ?? 50;
      params.value.refresh = refresh;
      const currentSort = params.value.sortBy
        ? librarySorting.current.value
        : undefined;
      const sortField = currentSort?.field as SortField | undefined;
      const selectedSortOption = librarySorting.selectedOption.value;
      params.value.sortField = sortField;
      params.value.sortDirection =
        selectedSortOption?.supports_direction === false ||
        (!selectedSortOption && sortField === SortField.ORIGINAL)
          ? undefined
          : currentSort?.direction;

      if (loadPagedData) {
        const nextItems = await loadPagedData(params.value);
        if (params.value.offset) pagedItems.value.push(...nextItems);
        else pagedItems.value = nextItems;
        if (Math.abs(nextItems.length - (props.limit ?? 50)) > 10) {
          allItemsReceived.value = true;
        }
      } else if (props.loadItems) {
        if (!initialDataReceived.value || refresh) {
          allItems.value = await props.loadItems(params.value);
          initialDataReceived.value = true;
        }
        const nextItems = getFilteredItems(allItems.value, params.value);
        if (params.value.offset) pagedItems.value.push(...nextItems);
        else pagedItems.value = nextItems;
        allItemsReceived.value = nextItems.length < (props.limit ?? 50);
      }
    } catch {
      params.value.offset = previousOffset;
      loadError.value = true;
    } finally {
      params.value.refresh = false;
      loading.value = false;
      tempHide.value = false;
    }

    if (pendingTabLoad || pendingSortReload) {
      const clearPendingItems = pendingTabLoad;
      const pendingParamsChanged = pendingSortReload;
      pendingTabLoad = false;
      pendingSortReload = false;
      await loadData(clearPendingItems, false, pendingParamsChanged);
    }
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
    if (loadError.value) {
      done("error");
      return;
    }
    await loadData(
      undefined,
      undefined,
      undefined,
      params.value.offset + (props.limit ?? 50),
    );
    done(loadError.value ? "error" : "ok");
  };

  const retryLoad = (loadNext: () => void) => {
    loadError.value = false;
    if (pagedItems.value.length === 0) loadData(true);
    else loadNext();
  };

  const loadAllItems = async () => {
    while (!allItemsReceived.value && !loadError.value) {
      if (disposed) return;
      await loadNextPage({ done: () => {} });
    }
  };

  return {
    allItems,
    allItemsReceived,
    initialDataReceived,
    librarySorting,
    loadAllItems,
    loadData,
    loadError,
    loadNextPage,
    loading,
    newContentAvailable,
    pagedItems,
    params,
    retryLoad,
    scheduleSortReload,
    serverSortOptions,
    sortOptions,
    sortOptionsLoaded,
    tempHide,
  };
}
