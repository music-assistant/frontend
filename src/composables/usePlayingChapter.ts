import { resolveActiveElapsedTime } from "@/helpers/activeElapsedTime";
import { resolveCurrentChapter } from "@/helpers/chapters";
import {
  PlaybackState,
  type Audiobook,
  type PodcastEpisode,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { useIntervalFn } from "@vueuse/core";
import { computed, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

const TICK_MS = 1000;

/**
 * The position of the chapter the active player is playing in the given item,
 * or undefined when it plays something else.
 */
export function usePlayingChapter(
  item: MaybeRefOrGetter<Audiobook | PodcastEpisode>,
) {
  const nowTick = ref(0);

  const playsItem = computed(() => {
    const current = toValue(item);
    const queueItem = store.curQueueItem;
    const media = store.activePlayer?.current_media;
    const playing = queueItem?.media_item;
    if (!playing || !media) return false;
    if (
      media.queue_item_id !== null &&
      media.queue_item_id !== queueItem.queue_item_id
    ) {
      return false;
    }
    const uris = [
      current.uri,
      ...current.provider_mappings.map(
        (x) => `${x.provider_instance}://${current.media_type}/${x.item_id}`,
      ),
    ];
    return uris.includes(playing.uri);
  });

  const { pause, resume } = useIntervalFn(
    () => (nowTick.value = Date.now()),
    TICK_MS,
    { immediate: false },
  );
  watch(
    () =>
      playsItem.value &&
      store.activePlayer?.playback_state === PlaybackState.PLAYING,
    (ticking) => (ticking ? resume() : pause()),
    { immediate: true },
  );

  return computed(() => {
    void nowTick.value;
    if (!playsItem.value) return undefined;
    return resolveCurrentChapter(
      toValue(item).metadata?.chapters,
      resolveActiveElapsedTime(),
      store.activePlayer?.current_media?.duration,
    )?.chapter.position;
  });
}
