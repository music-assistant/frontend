import { subscribeOwnFavorites } from "@/helpers/favorites";
import api from "@/plugins/api";
import { MediaType } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { computed, effectScope, ref, watch } from "vue";

/**
 * The signed-in user's like or dislike of the item the active player is
 * playing, and the actions that change it.
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
  const favorite = ref<boolean | null>(null);
  watch(
    () => store.curQueueItem?.queue_item_id,
    () => {
      favorite.value = currentItem.value?.favorite ?? null;
    },
    { immediate: true },
  );

  // follow the server's own view of the state once it confirms a change
  subscribeOwnFavorites((update) => {
    if (currentItem.value?.uri === update.uri) favorite.value = update.favorite;
  });

  const toggleFavorite = async () => {
    await setFavorite(favorite.value === true ? null : true);
  };

  /**
   * Set the state on the current item.
   *
   * :param state: true to like, false to dislike, null to clear the state.
   */
  const setFavorite = async (state: boolean | null) => {
    const item = currentItem.value;
    if (!item) return;
    if (state === null) {
      await clearFavorite();
      return;
    }
    favorite.value = state;
    // both take the item, so they mark it themselves; clearing takes ids only,
    // which is why that path marks it there
    if (state) await api.addItemToFavorites(item);
    else await api.setFavorite(item, false);
  };

  const addToPlaylist = () => {
    if (!currentItem.value) return;
    eventbus.emit("playlistdialog", { items: [currentItem.value] });
  };

  const clearFavorite = async () => {
    const item = currentItem.value;
    if (!item) return;
    // the queue can hold the provider's copy of the item, whose id the library
    // does not know - the state sits on the library item
    const libraryItem =
      item.provider === "library"
        ? item
        : await api.getLibraryItem(
            item.media_type,
            item.item_id,
            item.provider,
          );
    // nothing to clear it on, so leave the state as it is
    if (!libraryItem) return;
    favorite.value = null;
    item.favorite = null;
    await api.removeItemFromFavorites(
      libraryItem.media_type,
      libraryItem.item_id,
    );
  };

  return {
    currentItem,
    isFavorite: computed(() => favorite.value === true),
    isDisliked: computed(() => favorite.value === false),
    toggleFavorite,
    setFavorite,
    addToPlaylist,
  };
}
