import { computed, onScopeDispose, ref } from "vue";

import { useLibrarySorting } from "@/composables/useLibrarySorting";
import {
  ListingType,
  MediaItemType,
  ProviderInstance,
  SortDirection,
  SortField,
  SortOptionInfo,
} from "@/plugins/api/interfaces";

// A load that returns more than this many items fewer (or more) than it asked
// for reached the end of the listing.
const PAGE_END_TOLERANCE = 10;

const isLastPage = (received: number, requested: number) =>
  Math.abs(received - requested) > PAGE_END_TOLERANCE;

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
  // the count the title showed: the page's own total covers the whole library
  // until it loads again, not the filters the visit was left on
  count?: number;
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
  // counts the loads that replace the rows, so a reload can tell a newer one
  // replaced them meanwhile
  let loadGeneration = 0;
  // a reload was asked for while a page was loading; it runs once that is in,
  // and the reloads that asked for it finish with it
  let pendingReload: { done: Promise<void>; finish: () => void } | undefined;
  const queueReload = () => {
    if (!pendingReload) {
      let finish = () => {};
      const done = new Promise<void>((resolve) => (finish = resolve));
      pendingReload = { done, finish };
    }
    return pendingReload.done;
  };
  // lets async work tell that the listing it is working for is already gone
  let disposed = false;

  onScopeDispose(() => {
    disposed = true;
    pendingReload?.finish();
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
    if (offset === 0) loadGeneration++;

    const previousOffset = params.value.offset;
    try {
      params.value.offset = offset;
      params.value.limit = props.limit;
      params.value.refresh = refresh;
      const currentSort = librarySorting.current.value;
      const selectedSortOption = librarySorting.selectedOption.value;
      params.value.sortField = currentSort.field as SortField;
      params.value.sortDirection =
        selectedSortOption?.supports_direction === false
          ? undefined
          : currentSort.direction;

      if (loadPagedData) {
        const requestedSort = {
          sortField: params.value.sortField,
          sortDirection: params.value.sortDirection,
        };
        const nextItems = await loadPagedData({ ...params.value });
        if (params.value.offset) pagedItems.value.push(...nextItems);
        else pagedItems.value = nextItems;
        displayedSort.value = requestedSort;
        retryFromStart = false;
        if (isLastPage(nextItems.length, props.limit)) {
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

    if (pendingReload && !loading.value) {
      const { finish } = pendingReload;
      pendingReload = undefined;
      await reloadLoadedItems();
      finish();
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
    if (retryFromStart || pagedItems.value.length === 0) {
      tempHide.value = true;
      return loadData(true);
    }
    loadNext();
  };

  const loadAllItems = async () => {
    while (!allItemsReceived.value && !loadError.value) {
      // the paging can outlast the listing, so stop fetching once it is gone
      if (disposed) return;
      await loadNextPage({ done: () => {} });
    }
  };

  // re-reads the listed items without clearing them, so the rows stay mounted
  // and the scroll position holds; rows that can't be read again are dropped
  // and loaded from the start, so none keeps showing what the source changed
  const reloadLoadedItems = async function (): Promise<void> {
    const activeTab = props.toolBarTabs?.length ? getActiveTab() : undefined;
    const loadPagedData = activeTab?.loadPagedData ?? props.loadPagedData;
    if (!loadPagedData || disposed) return;
    // a page that is loading was read from the old rows
    if (loading.value) return queueReload();
    const generation = ++loadGeneration;
    // every page loaded so far, so the next page still follows on
    const offset = params.value.offset;
    const limit = offset + props.limit;
    const requestedSort = {
      sortField: params.value.sortField,
      sortDirection: params.value.sortDirection,
    };
    let items: MediaItemType[] | undefined;
    try {
      items = await loadPagedData({ ...params.value, offset: 0, limit });
    } catch {
      // the api already reports the failure to the user
    }
    if (disposed) return;
    // a page appended meanwhile followed the old rows, so read them all again
    if (loading.value) return queueReload();
    const replaced = generation !== loadGeneration;
    // a load that replaced the rows meanwhile has the newer items
    if (replaced && !loadError.value) return;
    if (items && !replaced) {
      if (params.value.offset !== offset) return reloadLoadedItems();
      pagedItems.value = items;
      displayedSort.value = requestedSort;
      allItemsReceived.value = isLastPage(items.length, limit);
      newContentAvailable.value = false;
      loadError.value = false;
      retryFromStart = false;
      return;
    }
    pagedItems.value = [];
    await loadData(true);
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
    reloadLoadedItems,
    retryLoad,
    serverSortOptions,
    sortOptions,
    sortOptionsLoaded,
    tempHide,
  };
}
