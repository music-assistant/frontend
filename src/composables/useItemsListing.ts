import { computed, onScopeDispose, ref } from "vue";

import { useCollectionMetadata } from "@/composables/useCollectionMetadata";
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
  randomSeed?: number;
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
  // the listing was left on a provider or album types carried in by a link,
  // ones the user has not picked: only going back shows that visit again
  carried: boolean;
  scrollPos: number;
  pagedItems: MediaItemType[];
  // the listing row of the first item in pagedItems
  baseOffset: number;
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
  useCollectionMetadata(() => pagedItems.value);
  // the listing row of pagedItems[0]: a jump loads the rows around its
  // target, and the rows above it load as the list scrolls up
  const baseOffset = ref(0);
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
      (option) => !(props.sortOptionExcludeFields ?? []).includes(option.field),
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
  // a jump asked for while a page was loading; only the latest one waits
  let pendingRow: { row: number; done: (loaded: boolean) => void } | undefined;
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
    pendingRow?.done(false);
  });

  const isDisposed = () => disposed;

  const pagedLoader = () => {
    if (props.toolBarTabs?.length) {
      const activeTab = getActiveTab();
      if (activeTab?.loadPagedData) return activeTab.loadPagedData;
    }
    return props.loadPagedData;
  };

  const loadData = async function (
    clear = false,
    refresh = false,
    filterParamsChanged = false,
    offset = 0,
  ) {
    const loadPagedData = pagedLoader();
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
      if (
        clear ||
        refresh ||
        filterParamsChanged ||
        params.value.randomSeed === undefined
      ) {
        params.value.randomSeed =
          currentSort.field === SortField.RANDOM ||
          currentSort.field === SortField.RANDOM_PLAY_COUNT
            ? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
            : undefined;
      }
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
        if (params.value.offset) {
          pagedItems.value.push(...nextItems);
        } else {
          pagedItems.value = nextItems;
          baseOffset.value = 0;
        }
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
    await runQueuedLoads();
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
    const loadPagedData = pagedLoader();
    if (!loadPagedData || disposed) return;
    // a page that is loading was read from the old rows
    if (loading.value) return queueReload();
    const generation = ++loadGeneration;
    // every page loaded so far, so the next page still follows on
    const base = baseOffset.value;
    const offset = params.value.offset;
    const limit = offset + props.limit - base;
    const requestedSort = {
      sortField: params.value.sortField,
      sortDirection: params.value.sortDirection,
    };
    let items: MediaItemType[] | undefined;
    try {
      items = await loadPagedData({ ...params.value, offset: base, limit });
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
      if (params.value.offset !== offset || baseOffset.value !== base) {
        return reloadLoadedItems();
      }
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

  /**
   * Make the given listing row part of the loaded items. A row that is not
   * loaded yet replaces them with the rows from a page above it to a page
   * below it. Resolves whether the row is loaded; false when the load failed,
   * a newer jump took its place or the listing's parameters changed meanwhile.
   */
  const loadRow = async function (row: number): Promise<boolean> {
    const loadPagedData = pagedLoader();
    if (!loadPagedData || disposed) return false;
    if (loading.value) {
      pendingRow?.done(false);
      return new Promise((done) => (pendingRow = { row, done }));
    }
    const loadedRows = pagedItems.value.length;
    if (row >= baseOffset.value && row < baseOffset.value + loadedRows) {
      return true;
    }
    loading.value = true;
    loadGeneration++;
    const start = Math.max(0, row - props.limit);
    const limit = row - start + props.limit;
    const requestedSort = {
      sortField: params.value.sortField,
      sortDirection: params.value.sortDirection,
    };
    let loaded = false;
    try {
      const items = await loadPagedData({
        ...params.value,
        offset: start,
        limit,
        refresh: false,
      });
      if (row < start + items.length) {
        pagedItems.value = items;
        baseOffset.value = start;
        // the next page follows the rows loaded here
        params.value.offset = row;
        displayedSort.value = requestedSort;
        allItemsReceived.value = isLastPage(items.length, limit);
        loadError.value = false;
        retryFromStart = false;
        loaded = true;
      }
    } catch {
      // the api already reports the failure to the user; the rows stay
    } finally {
      loading.value = false;
    }
    if (disposed) return false;
    const superseded = pendingTabLoad || pendingRefresh || pendingParamsChange;
    await runQueuedLoads();
    return loaded && !superseded;
  };

  /**
   * Load the page above the loaded items and put it in front of them.
   * `onPrepend` runs right after the rows are added, before they are shown.
   * Resolves whether rows were added; nothing loads while another load is busy.
   */
  const loadPreviousPage = async function (
    onPrepend: () => void,
  ): Promise<boolean> {
    const loadPagedData = pagedLoader();
    const end = baseOffset.value;
    if (!loadPagedData || disposed || loading.value || end === 0) return false;
    loading.value = true;
    const start = Math.max(0, end - props.limit);
    let added = false;
    try {
      const items = await loadPagedData({
        ...params.value,
        offset: start,
        limit: end - start,
        refresh: false,
      });
      pagedItems.value = [...items.slice(0, end - start), ...pagedItems.value];
      baseOffset.value = start;
      onPrepend();
      added = items.length > 0;
    } catch {
      // the api already reports the failure to the user
    } finally {
      loading.value = false;
    }
    if (disposed) return false;
    await runQueuedLoads();
    return added;
  };

  // runs what was asked for while a load was busy; new parameters go first
  // and leave a waiting jump without its target
  const runQueuedLoads = async function () {
    if (pendingTabLoad || pendingRefresh || pendingParamsChange) {
      const replayClear = pendingTabLoad || pendingClear;
      const replayRefresh = pendingRefresh;
      const replayParamsChange = pendingParamsChange;
      pendingTabLoad = false;
      pendingClear = false;
      pendingRefresh = false;
      pendingParamsChange = false;
      pendingRow?.done(false);
      pendingRow = undefined;
      await loadData(replayClear, replayRefresh, replayParamsChange);
    }

    if (pendingReload && !loading.value) {
      const { finish } = pendingReload;
      pendingReload = undefined;
      await reloadLoadedItems();
      finish();
    }

    if (pendingRow && !loading.value) {
      const { row, done } = pendingRow;
      pendingRow = undefined;
      done(await loadRow(row));
    }
  };

  return {
    allItemsReceived,
    baseOffset,
    displayedSort,
    isDisposed,
    librarySorting,
    loadAllItems,
    loadData,
    loadError,
    loadNextPage,
    loadPreviousPage,
    loadRow,
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
