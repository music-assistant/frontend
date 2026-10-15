import type { LoadDataParams } from "@/composables/useItemsListing";
import { api } from "@/plugins/api";
import { getCollectionMediaTypeFromItemId } from "@/plugins/api/helpers";
import {
  MediaType,
  type MediaCollection,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { computed, ref, watch } from "vue";

interface CollectionRef {
  itemId: string;
  provider: string;
}

export function useCollectionDetails(collection: () => CollectionRef) {
  const itemDetails = ref<MediaCollection<MediaItemType>>();
  const collectionMediaType = computed(() =>
    getCollectionMediaTypeFromItemId(collection().itemId),
  );

  watch(
    () => [collection().itemId, collection().provider] as const,
    () => {
      itemDetails.value = undefined;
    },
  );

  const loadCollectionItems = async (
    params: LoadDataParams,
  ): Promise<MediaItemType[]> => {
    if (collectionMediaType.value !== MediaType.AUDIOBOOK) return [];
    const { itemId, provider } = collection();
    if (!itemDetails.value) {
      const snapshot = await api.getAudiobookCollection(itemId, undefined, 0);
      if (itemId !== collection().itemId || provider !== collection().provider)
        return [];
      itemDetails.value = snapshot;
    }
    const page = await api.getAudiobookCollection(
      itemId,
      params.search,
      params.limit,
      params.offset,
      params.favoritesOnly,
    );
    return page.items;
  };

  return { itemDetails, collectionMediaType, loadCollectionItems };
}
