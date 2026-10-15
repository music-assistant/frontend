import { computed, onScopeDispose, ref } from "vue";

import { useLibrarySorting } from "@/composables/useLibrarySorting";
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
  // several listings share one path across different parents (e.g. every
  // artist's albums use "artistalbums"), so the parent's uri scopes the
  // restore to the item that was actually on screen
  parentUri?: string;
  // the listing was left on a provider carried in by a link, one the user has
  // not picked: only going back shows that visit again
  carried: boolean;
  scrollPos: number;
  pagedItems: MediaItemType[];
  allItemsReceived: boolean;
  params: LoadDataParams;
  displayedSort: Pick<LoadDataParams, "sortField" | "sortDirection">;
}

interface ItemsListingDataOptions {
  sortListing?: ListingType;
  sortOptionExcludeFields?: SortField[];
  loadPagedData?: LoadPagedDataFn;
  limit: number;
  toolBarTabs?: ToolBarTab[];
}

export function useItemsListing(
  props: Readonly<ItemsListingDataOptions>,
  getActiveTab: () => ToolBarTab | undefined,
) {
  const params = ref<LoadDataParams>({
    offset: 0,
    limit: props.limit,
    sortBy: "name",
    search: "",
    libraryOnly: false,
    genreIds: undefined,
  });
  const pagedItems = ref<MediaItemType[]>([]);
  const displayedSort = ref<
    Pick<LoadDataParams, "sortField" | "sortDirection">
  >({});
  const loading = ref(false);
  const newContentAvailable = ref(false);
  const allItemsReceived = ref(false);
  // set when the last load failed; scrolling does not retry it, the user does
  const loadError = ref(false);
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

  // used in tabbed item listings to prevent a timing-race condition, where
  // the selected tab shows items of the initial tab on entering the page
  let loadingTabId: string | undefined;
  let pendingTabLoad = false;

  let pendingClear = false;
  let pendingRefresh = false;
  let pendingParamsChange = false;
  let retryFromStart = false;
  // lets async work tell that the listing it is working for is already gone
  let disposed = false;

  onScopeDispose(() => {
    disposed = true;
  });

  const isDisposed = () => disposed;

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
      // Record whether the currently requested tab differs from the tab being
      // loaded. Using assignment (not only setting to true) avoids a redundant
      // reload if the user switches tabs and then switches back before the
      // current load finishes.
      pendingTabLoad = currentTabId !== loadingTabId;
      pendingRefresh ||= refresh;
      // only a parameter change queues its clear: a tab change is left to
      // pendingTabLoad, so switching back to the loading tab does not reload
      if (filterParamsChanged) {
        pendingParamsChange = true;
        pendingClear ||= clear;
      }
      return;
    }
    loading.value = true;
    loadingTabId = currentTabId;
    // a reload the user asked for gets a fresh attempt
    if (clear || refresh || filterParamsChanged) loadError.value = false;
    // on paged server listings, we need to clear the list on filter params change
    if (filterParamsChanged && loadPagedData) clear = true;

    if (clear || refresh) {
      offset = 0;
      // this hack is needed in order to force refresh the infinite scroller
      // otherwise it will not attempt to load more items if the end was reached
      // and then we load new items with a different size
      if (allItemsReceived.value) tempHide.value = true;
      allItemsReceived.value = false;
      newContentAvailable.value = false;
    }

    const previousOffset = params.value.offset;
    try {
      params.value.offset = offset;
      params.value.limit = props.limit;
      params.value.refresh = refresh;
      // a listing without sort keys keeps the order its items are loaded in
      const currentSort = params.value.sortBy
        ? librarySorting.current.value
        : undefined;
      const sortField = currentSort?.field as SortField | undefined;
      const selectedSortOption = librarySorting.selectedOption.value;
      params.value.sortField = sortField;
      params.value.sortDirection =
        selectedSortOption?.supports_direction === false
          ? undefined
          : currentSort?.direction;

      if (loadPagedData) {
        const requestedSort = {
          sortField: params.value.sortField,
          sortDirection: params.value.sortDirection,
        };
        const nextItems = await loadPagedData(params.value);
        if (params.value.offset) pagedItems.value.push(...nextItems);
        else pagedItems.value = nextItems;
        displayedSort.value = requestedSort;
        retryFromStart = false;
        if (Math.abs(nextItems.length - props.limit) > 10) {
          allItemsReceived.value = true;
        }
      }
    } catch {
      // the api already reports the failure to the user; the failed page is
      // loaded next
      params.value.offset = previousOffset;
      retryFromStart = offset === 0;
      loadError.value = true;
    } finally {
      params.value.refresh = false;
      loading.value = false;
      tempHide.value = false;
    }

    if (disposed) return;

    if (pendingTabLoad || pendingRefresh || pendingParamsChange) {
      const replayClear = pendingTabLoad || pendingClear;
      const replayRefresh = pendingRefresh;
      const replayParamsChange = pendingParamsChange;
      pendingTabLoad = false;
      pendingClear = false;
      pendingRefresh = false;
      pendingParamsChange = false;
      await loadData(replayClear, replayRefresh, replayParamsChange);
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
    // the infinite scroller is re-created whenever a load starts and ends, and
    // a new one loads right away, so a failed load would otherwise be retried
    // as fast as it fails
    if (loadError.value) {
      done("error");
      return;
    }
    await loadData(
      undefined,
      undefined,
      undefined,
      params.value.offset + props.limit,
    );
    done(loadError.value ? "error" : "ok");
  };

  const retryLoad = (loadNext: () => void) => {
    loadError.value = false;
    if (retryFromStart || pagedItems.value.length === 0) return loadData(true);
    loadNext();
  };

  const loadAllItems = async () => {
    while (!allItemsReceived.value && !loadError.value) {
      // the paging can outlast the listing, so stop fetching once it is gone
      if (disposed) return;
      await loadNextPage({ done: () => {} });
    }
  };

  return {
    allItemsReceived,
    displayedSort,
    isDisposed,
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
    serverSortOptions,
    sortOptions,
    sortOptionsLoaded,
    tempHide,
  };
}
