import api from "@/plugins/api";
import {
  EventType,
  MediaType,
  type EventMessage,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { computed, effectScope, readonly, ref, watch } from "vue";

/**
 * Favourite state of the item the active player is playing, and the actions
 * that change it.
 *
 * Shared by every surface showing it, so favouriting from the full screen
 * player is reflected on the player bar behind it.
 */
export function useCurrentItemFavorite() {
  // an effect scope of its own: the watcher outlives whichever component
  // happened to ask for it first
  shared ??= effectScope(true).run(createCurrentItemFavorite)!;
  return shared;
}

let shared: ReturnType<typeof createCurrentItemFavorite> | undefined;

function createCurrentItemFavorite() {
  // a line-in or other live source has nothing to favourite or collect
  const currentItem = computed(() => {
    const item = store.curQueueItem?.media_item;
    return item?.media_type === MediaType.AUDIO_SOURCE ? undefined : item;
  });

  // Held apart from media_item.favorite: the server replaces the whole queue
  // item on refresh, which would drop an optimistic change with it.
  const isFavorite = ref(false);
  watch(
    () => store.curQueueItem?.queue_item_id,
    () => {
      isFavorite.value = currentItem.value?.favorite ?? false;
    },
    { immediate: true },
  );

  // follow the server's own view of the favourite once it confirms a change
  api.subscribe(EventType.MEDIA_ITEM_UPDATED, (evt: EventMessage) => {
    const updatedItem = evt.data as MediaItemType;
    if (
      "favorite" in updatedItem &&
      currentItem.value?.uri === updatedItem.uri
    ) {
      isFavorite.value = updatedItem.favorite;
    }
  });

  const toggleFavorite = async () => {
    const item = currentItem.value;
    if (!item) return;
    if (!isFavorite.value) {
      isFavorite.value = true;
      api.addItemToFavorites(item);
      return;
    }
    // the queue can hold the provider's copy of the item, whose id the library
    // does not know - the favourite sits on the library item
    const libraryItem =
      item.provider === "library"
        ? item
        : await api.getLibraryItem(
            item.media_type,
            item.item_id,
            item.provider,
          );
    // nothing to remove it from, so leave the heart saying it is a favourite
    if (!libraryItem) return;
    isFavorite.value = false;
    item.favorite = false;
    api.removeItemFromFavorites(libraryItem.media_type, libraryItem.item_id);
  };

  const addToPlaylist = () => {
    if (!currentItem.value) return;
    eventbus.emit("playlistdialog", { items: [currentItem.value] });
  };

  return {
    currentItem,
    isFavorite: readonly(isFavorite),
    toggleFavorite,
    addToPlaylist,
  };
}
