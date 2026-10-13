import {
  useItemsListing,
  type LoadDataParams,
  type LoadPagedDataFn,
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

function setupItemsListing(options: {
  limit?: number;
  loadItems?: (params: LoadDataParams) => Promise<Track[]>;
  loadPagedData?: LoadPagedDataFn;
  sortListing?: ListingType;
}) {
  const scope = effectScope();
  scopes.push(scope);
  const listing = scope.run(() =>
    useItemsListing(
      {
        itemtype: "tracks",
        ...options,
      },
      () => undefined,
    ),
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

  it("filters and pages flat listings without reloading their source", async () => {
    const loadItems = vi.fn(async () => [
      track({ item_id: "track-b", name: "B Side" }),
      track({ item_id: "track-a", name: "A Side" }),
    ]);
    const listing = setupItemsListing({ limit: 1, loadItems });

    await listing.loadData(true);
    expect(listing.pagedItems.value.map((item) => item.item_id)).toEqual([
      "track-a",
    ]);

    await listing.loadNextPage({ done: vi.fn() });
    expect(listing.pagedItems.value.map((item) => item.item_id)).toEqual([
      "track-a",
      "track-b",
    ]);
    expect(loadItems).toHaveBeenCalledTimes(1);
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
