import { subscribeOwnFavorites } from "@/helpers/favorites";
import { MediaType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computed, effectScope, ref, watch } from "vue";

/**
 * The signed-in user's like or dislike of the item the active player is
 * playing.
 *
 * Shared by every surface showing it, so favouring from the full screen
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
    return !item || item.media_type === MediaType.AUDIO_SOURCE
      ? undefined
      : item;
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

  return { currentItem, favorite };
}
