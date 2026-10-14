import { computed, onScopeDispose, ref } from "vue";

import { useLibrarySorting } from "@/composables/useLibrarySorting";
import { filterAndSortItems } from "@/helpers/itemListing";
import {
  ListingType,
  MediaItemType,
  MediaType,
  ProviderInstance,
  SortDirection,
  SortField,
  SortOptionInfo,
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
  let pendingClear = false;
  let pendingRefresh = false;
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
      pendingRefresh ||= refresh;
      // only a parameter change queues its clear: a tab change is left to
      // pendingTabLoad, so switching back to the loading tab does not reload
      if (filterParamsChanged) {
        pendingSortReload = true;
        pendingClear ||= clear;
      }
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
        const nextItems = filterAndSortItems(allItems.value, params.value);
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

    if (disposed) return;

    if (pendingTabLoad || pendingClear || pendingRefresh || pendingSortReload) {
      const clearPendingItems = pendingTabLoad || pendingClear;
      const refreshPendingItems = pendingRefresh;
      const pendingParamsChanged = pendingSortReload;
      pendingTabLoad = false;
      pendingClear = false;
      pendingRefresh = false;
      pendingSortReload = false;
      await loadData(
        clearPendingItems,
        refreshPendingItems,
        pendingParamsChanged,
      );
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
