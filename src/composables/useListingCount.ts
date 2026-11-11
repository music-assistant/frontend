import type { LoadDataParams } from "@/composables/useItemsListing";
import { listingItemCount } from "@/helpers/listing_filters";
import type { MediaItemType } from "@/plugins/api/interfaces";
import { computed, ref, watch, type Ref } from "vue";

interface ListingCountOptions {
  // the count the page fetched, if it has one
  total?: number;
  requireProviderSelection?: boolean;
  showCollapseCollections?: boolean;
}

interface ListingCountState {
  params: Ref<LoadDataParams>;
  pagedItems: Ref<MediaItemType[]>;
  allItemsReceived: Ref<boolean>;
  loading: Ref<boolean>;
}

/**
 * The item count a listing shows beside its title. The page's own count only
 * takes the filters its request was written for; a cached visit comes back
 * with the count it showed, kept while it pages on and dropped once it loads
 * from its first page again.
 */
export function useListingCount(
  options: Readonly<ListingCountOptions>,
  state: ListingCountState,
) {
  const restoredCount = ref<{ count?: number }>();

  // the offset too: a reload queued behind a page that was loading turns the
  // loading flag off and on in one go, which leaves only the offset to tell
  watch(
    [state.loading, () => state.params.value.offset],
    ([isLoading, offset]) => {
      if (isLoading && !offset) restoredCount.value = undefined;
    },
  );

  const listingCount = computed(() => {
    if (restoredCount.value && !state.allItemsReceived.value) {
      return restoredCount.value.count;
    }
    const p = state.params.value;
    return listingItemCount({
      total: options.total,
      loaded: state.pagedItems.value.length,
      allLoaded: state.allItemsReceived.value,
      narrowedBeyondTotal: Boolean(
        p.search ||
        (Array.isArray(p.genreIds)
          ? p.genreIds.length
          : p.genreIds !== undefined) ||
        (p.provider?.length && !options.requireProviderSelection) ||
        p.libraryOnly ||
        p.hideFullyPlayed ||
        (options.showCollapseCollections && p.collapseCollections),
      ),
    });
  });

  /** Show the count a cached visit came back with. */
  const restoreCount = (count: number | undefined) => {
    restoredCount.value = { count };
  };

  return { listingCount, restoreCount };
}
