import { keepOwnFavorite, subscribeOwnFavorites } from "@/helpers/favorites";
import { api } from "@/plugins/api";
import { EXTERNAL_PROVIDER } from "@/plugins/api/helpers";
import {
  EventType,
  type MediaType,
  type EventMessage,
  type MediaItem,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { onScopeDispose, type Ref } from "vue";

// waits out the burst of updates a server action touching many items sends
const ITEM_UPDATE_DELAY_MS = 2000;

/** Options for useDetailItemUpdates. */
export interface DetailItemUpdatesOptions {
  /**
   * The provider item the page was opened with; an update to an item mapped to
   * it with the same media type also replaces the item, as when a provider item
   * was added to the library. For an external address, the item it was found
   * as takes its place.
   */
  providerItem?: { itemId: string; provider: string; mediaType: MediaType };
  /** Called after the item was replaced by an update. */
  onUpdate?: () => void;
}

/**
 * Keeps the item of a detail page in step with the server.
 *
 * An updated item with the same uri replaces it, keeping the signed-in user's
 * favorite state, once its updates have stopped for two seconds; only the last
 * one is applied. That user's own likes and dislikes are applied to it straight
 * away. Both subscriptions end with the calling component or scope.
 *
 * :param item: The item shown on the page.
 * :param options: See DetailItemUpdatesOptions.
 */
export function useDetailItemUpdates<T extends MediaItem>(
  item: Ref<T | undefined>,
  options: DetailItemUpdatesOptions = {},
): void {
  const matches = (updatedItem: MediaItemType) =>
    item.value?.uri === updatedItem.uri ||
    mapsToProviderItem(
      updatedItem,
      foundProviderItem(options.providerItem, item.value),
    );

  let pending: MediaItemType | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const applyPending = () => {
    const updatedItem = pending!;
    pending = undefined;
    // the page may have moved on to another item meanwhile
    if (!matches(updatedItem)) return;
    item.value = keepOwnFavorite(updatedItem, item.value) as T;
    options.onUpdate?.();
  };

  const unsubItem = api.subscribe(
    EventType.MEDIA_ITEM_UPDATED,
    (evt: EventMessage) => {
      const updatedItem = evt.data as MediaItemType;
      if (!matches(updatedItem)) return;
      pending = updatedItem;
      clearTimeout(timer);
      timer = setTimeout(applyPending, ITEM_UPDATE_DELAY_MS);
    },
  );

  // the user's own like or dislike, wherever they made it
  const unsubFavorite = subscribeOwnFavorites((update) => {
    if (item.value?.uri === update.uri) {
      item.value.favorite = update.favorite;
    }
  });

  onScopeDispose(() => {
    clearTimeout(timer);
    unsubItem();
    unsubFavorite();
  });
}

/**
 * The provider item updates are matched against: the one the page was opened
 * with, or for an external address the item it was found as.
 */
function foundProviderItem(
  providerItem: DetailItemUpdatesOptions["providerItem"],
  shown: MediaItem | undefined,
): DetailItemUpdatesOptions["providerItem"] {
  if (providerItem?.provider !== EXTERNAL_PROVIDER || !shown) {
    return providerItem;
  }
  return {
    itemId: shown.item_id,
    provider: shown.provider,
    mediaType: providerItem.mediaType,
  };
}

function mapsToProviderItem(
  updatedItem: MediaItemType,
  providerItem: DetailItemUpdatesOptions["providerItem"],
): boolean {
  if (
    !providerItem ||
    updatedItem.media_type !== providerItem.mediaType ||
    !("provider_mappings" in updatedItem)
  )
    return false;
  return updatedItem.provider_mappings.some(
    (mapping) =>
      mapping.item_id === providerItem.itemId &&
      [mapping.provider_instance, mapping.provider_domain].includes(
        providerItem.provider,
      ),
  );
}
