import {
  useItemsListing,
  type LoadDataParams,
  type LoadPagedDataFn,
  type ToolBarTab,
} from "@/composables/useItemsListing";
import {
  ListingType,
  SortDirection,
  SortField,
  type SortOptionInfo,
  type Track,
} from "@/plugins/api/interfaces";
import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope, type EffectScope } from "vue";
import { track } from "../fixtures/track";

const scopes: EffectScope[] = [];

function setupItemsListing(
  options: {
    limit?: number;
    loadPagedData?: LoadPagedDataFn;
    sortListing?: ListingType;
    toolBarTabs?: ToolBarTab[];
  },
  getActiveTab: () => ToolBarTab | undefined = () => undefined,
) {
  const scope = effectScope();
  scopes.push(scope);
  const listing = scope.run(() =>
    useItemsListing({ limit: 50, ...options }, getActiveTab),
  )!;
  return { scope, ...listing };
}

const sortOption = (
  field: SortField,
  direction: SortDirection | null,
  supportsDirection = true,
): SortOptionInfo => ({
  field,
  supports_direction: supportsDirection,
  default_direction: direction,
  label_key: field,
});

describe("useItemsListing", () => {
  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop());
  });

  it("filters directionless random options from paged library listings", () => {
    const listing = setupItemsListing({
      sortListing: ListingType.LIBRARY_TRACKS,
      loadPagedData: async () => [],
    });
    listing.serverSortOptions.value = [
      sortOption(SortField.SORT_NAME, SortDirection.ASC),
      sortOption(SortField.RANDOM, null, false),
      sortOption(SortField.RANDOM_PLAY_COUNT, null, false),
    ];

    expect(listing.sortOptions.value.map((option) => option.field)).toEqual([
      SortField.SORT_NAME,
    ]);
  });

  it("sends typed sort parameters and appends the next page", async () => {
    const loadPagedData = vi
      .fn()
      .mockResolvedValueOnce([track({ item_id: "track-1" })])
      .mockResolvedValueOnce([track({ item_id: "track-2" })]);
    const listing = setupItemsListing({ limit: 1, loadPagedData });
    listing.serverSortOptions.value = [
      sortOption(SortField.TIMESTAMP_ADDED, SortDirection.DESC),
    ];
    listing.params.value.sortBy = "timestamp_added:desc";

    await listing.loadData(true);

    expect(loadPagedData).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        offset: 0,
        limit: 1,
        sortField: SortField.TIMESTAMP_ADDED,
        sortDirection: SortDirection.DESC,
      }),
    );

    const done = vi.fn();
    await listing.loadNextPage({ done });

    expect(loadPagedData).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ offset: 1 }),
    );
    expect(listing.pagedItems.value.map((item) => item.item_id)).toEqual([
      "track-1",
      "track-2",
    ]);
    expect(done).toHaveBeenCalledWith("ok");
  });

  it("retries a failed sort from the start and replaces the displayed rows", async () => {
    const items = [track({ item_id: "track-1" })];
    const nextItems = [track({ item_id: "track-2" })];
    const sortedItems = [track({ item_id: "duration-first" })];
    const loadPagedData = vi
      .fn()
      .mockResolvedValueOnce([...items])
      .mockResolvedValueOnce(nextItems)
      .mockRejectedValueOnce(new Error("sort failed"))
      .mockResolvedValueOnce(sortedItems);
    const listing = setupItemsListing({ limit: 1, loadPagedData });
    listing.serverSortOptions.value = [
      sortOption(SortField.NAME, SortDirection.ASC),
      sortOption(SortField.DURATION, SortDirection.DESC),
    ];
    listing.params.value.sortBy = "name:asc";
    await listing.loadData(true);
    await listing.loadNextPage({ done: vi.fn() });

    listing.params.value.sortBy = "duration:desc";
    await listing.loadData(true, false, true);

    expect(listing.loadError.value).toBe(true);
    expect(listing.pagedItems.value).toEqual([...items, ...nextItems]);
    expect(listing.displayedSort.value).toEqual({
      sortField: SortField.NAME,
      sortDirection: SortDirection.ASC,
    });

    const loadNext = vi.fn(() => listing.loadNextPage({ done: vi.fn() }));
    await listing.retryLoad(loadNext);

    expect(loadNext).not.toHaveBeenCalled();
    expect(loadPagedData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        offset: 0,
        sortField: SortField.DURATION,
        sortDirection: SortDirection.DESC,
      }),
    );
    expect(listing.pagedItems.value).toEqual(sortedItems);
    expect(listing.loadError.value).toBe(false);
    expect(listing.displayedSort.value).toEqual({
      sortField: SortField.DURATION,
      sortDirection: SortDirection.DESC,
    });
  });

  it("sends no direction for a sort option without one", async () => {
    const loadPagedData = vi.fn().mockResolvedValue([]);
    const listing = setupItemsListing({ loadPagedData });
    listing.serverSortOptions.value = [
      sortOption(SortField.ORIGINAL, null, false),
    ];
    listing.params.value.sortBy = "original";

    await listing.loadData(true);

    expect(loadPagedData).toHaveBeenCalledWith(
      expect.objectContaining({
        sortField: SortField.ORIGINAL,
        sortDirection: undefined,
      }),
    );
  });

  it("coalesces same-tab sort changes into a reload with the latest selection", async () => {
    let resolveFirstPage!: (items: Track[]) => void;
    const firstPage = new Promise<Track[]>((resolve) => {
      resolveFirstPage = resolve;
    });
    const requests: LoadDataParams[] = [];
    const loadPagedData = vi.fn((params: LoadDataParams) => {
      requests.push({ ...params });
      return requests.length === 1
        ? firstPage
        : Promise.resolve([track({ item_id: "latest-order" })]);
    });
    const listing = setupItemsListing({ loadPagedData });
    listing.serverSortOptions.value = [
      sortOption(SortField.NAME, SortDirection.ASC),
      sortOption(SortField.PLAY_COUNT, SortDirection.DESC),
    ];
    const initialLoad = listing.loadData(true);

    listing.params.value.sortBy = "play_count:desc";
    await listing.loadData(false, false, true);
    listing.params.value.sortBy = "play_count:asc";
    await listing.loadData(false, false, true);
    expect(loadPagedData).toHaveBeenCalledTimes(1);

    resolveFirstPage([track({ item_id: "old-order" })]);
    await initialLoad;

    expect(loadPagedData).toHaveBeenCalledTimes(2);
    expect(requests[0].sortField).toBe(SortField.NAME);
    expect(requests[1]).toEqual(
      expect.objectContaining({
        offset: 0,
        sortField: SortField.PLAY_COUNT,
        sortDirection: SortDirection.ASC,
      }),
    );
    expect(listing.pagedItems.value.map((item) => item.item_id)).toEqual([
      "latest-order",
    ]);
  });

  it("does not process a queued sort reload after its scope is disposed", async () => {
    let resolveFirstPage!: (items: Track[]) => void;
    const loadPagedData = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Track[]>((resolve) => {
            resolveFirstPage = resolve;
          }),
      )
      .mockResolvedValueOnce([]);
    const listing = setupItemsListing({ loadPagedData });
    const initialLoad = listing.loadData(true);

    listing.params.value.sortBy = "duration";
    await listing.loadData(false, false, true);
    expect(loadPagedData).toHaveBeenCalledTimes(1);

    listing.scope.stop();
    resolveFirstPage([track({ item_id: "track-1" })]);
    await initialLoad;

    expect(loadPagedData).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: "loads the tab switched to",
      switchedTo: ["authors"],
      loadedTabs: ["books", "authors"],
    },
    {
      name: "does not reload when switched back to the loading tab",
      switchedTo: ["authors", "books"],
      loadedTabs: ["books"],
    },
  ])("$name during a load", async ({ switchedTo, loadedTabs }) => {
    let resolveFirstPage!: (items: Track[]) => void;
    const loadedTabIds: string[] = [];
    const makeTab = (id: string): ToolBarTab => ({
      id,
      label: id,
      loadPagedData: () => {
        loadedTabIds.push(id);
        return loadedTabIds.length === 1
          ? new Promise<Track[]>((resolve) => {
              resolveFirstPage = resolve;
            })
          : Promise.resolve([]);
      },
    });
    const toolBarTabs = [makeTab("books"), makeTab("authors")];
    let activeTab = toolBarTabs[0];
    const listing = setupItemsListing({ toolBarTabs }, () => activeTab);
    const initialLoad = listing.loadData(true);

    for (const tabId of switchedTo) {
      activeTab = toolBarTabs.find((tab) => tab.id === tabId)!;
      await listing.loadData(true);
    }
    resolveFirstPage([]);
    await initialLoad;

    expect(loadedTabIds).toEqual(loadedTabs);
  });

  it("stops loading additional pages after its scope is disposed", async () => {
    let resolveFirstPage!: (items: Track[]) => void;
    const loadPagedData = vi
      .fn()
      .mockReturnValueOnce(
        new Promise<Track[]>((resolve) => {
          resolveFirstPage = resolve;
        }),
      )
      .mockResolvedValue([]);
    const listing = setupItemsListing({ limit: 1, loadPagedData });
    const loadAll = listing.loadAllItems();

    listing.scope.stop();
    resolveFirstPage([track({ item_id: "track-1" })]);
    await loadAll;

    expect(loadPagedData).toHaveBeenCalledTimes(1);
  });
});
