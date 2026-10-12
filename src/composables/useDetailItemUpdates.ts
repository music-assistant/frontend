import { keepOwnFavorite, subscribeOwnFavorites } from "@/helpers/favorites";
import { api } from "@/plugins/api";
import {
  EventType,
  type EventMessage,
  type MediaItem,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { onScopeDispose, type Ref } from "vue";

/** Options for useDetailItemUpdates. */
export interface DetailItemUpdatesOptions {
  /**
   * The provider item the page was opened with; an update to an item mapped to
   * it also replaces the item, as when a provider item was added to the library.
   */
  providerItem?: { itemId: string; provider: string };
  /** Called after the item was replaced by an update. */
  onUpdate?: () => void;
}

/**
 * Keeps the item of a detail page in step with the server.
 *
 * An updated item with the same uri replaces it, keeping the signed-in user's
 * favorite state, and that user's own likes and dislikes are applied to it. Both
 * subscriptions end with the calling component or scope.
 *
 * :param item: The item shown on the page.
 * :param options: See DetailItemUpdatesOptions.
 */
export function useDetailItemUpdates<T extends MediaItem>(
  item: Ref<T | undefined>,
  options: DetailItemUpdatesOptions = {},
): void {
  const unsubItem = api.subscribe(
    EventType.MEDIA_ITEM_UPDATED,
    (evt: EventMessage) => {
      const updatedItem = evt.data as MediaItemType;
      if (
        item.value?.uri !== updatedItem.uri &&
        !mapsToProviderItem(updatedItem, options.providerItem)
      ) {
        return;
      }
      item.value = keepOwnFavorite(updatedItem, item.value) as T;
      options.onUpdate?.();
    },
  );

  // the user's own like or dislike, wherever they made it
  const unsubFavorite = subscribeOwnFavorites((update) => {
    if (item.value?.uri === update.uri) item.value.favorite = update.favorite;
  });

  onScopeDispose(() => {
    unsubItem();
    unsubFavorite();
  });
}

function mapsToProviderItem(
  updatedItem: MediaItemType,
  providerItem: DetailItemUpdatesOptions["providerItem"],
): boolean {
  if (!providerItem || !("provider_mappings" in updatedItem)) return false;
  return updatedItem.provider_mappings.some(
    (mapping) =>
      mapping.item_id === providerItem.itemId &&
      [mapping.provider_instance, mapping.provider_domain].includes(
        providerItem.provider,
      ),
  );
}
