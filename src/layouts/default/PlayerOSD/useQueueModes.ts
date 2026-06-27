// Shared reactive state for the queue's "keep playing" modes — radio (an
// infinite, self-refilling mix) and autoplay. Both the fullscreen header
// controls and the queue mode banner read these, so the (mutually exclusive)
// logic lives in one place instead of being duplicated per component.
import api from "@/plugins/api";
import { isQueueInfiniteStream } from "@/plugins/api/helpers";
import type { MediaItemType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computed } from "vue";

export function useQueueModes() {
  const queue = computed(() => store.activePlayerQueue);

  // Radio mode (infinite mix): the seed items the queue is based on, if any.
  const radioSources = computed<MediaItemType[]>(
    () => queue.value?.radio_source ?? [],
  );
  const radioModeActive = computed(() => radioSources.value.length > 0);

  // Autoplay: keeps the music going by appending more tracks when the queue
  // runs out.
  const autoplayEnabled = computed(
    () => queue.value?.autoplay_enabled === true,
  );

  // Autoplay only applies to an active queue playing regular tracks, and is
  // moot while radio mode is active (the two are mutually exclusive — radio
  // already keeps the queue refilling itself).
  const autoplayApplicable = computed(() => {
    const q = queue.value;
    if (!q || !q.active) return false;
    if (isQueueInfiniteStream(q)) return false;
    if (radioModeActive.value) return false;
    return "autoplay_enabled" in q;
  });

  const setAutoplay = (enabled: boolean) => {
    const q = queue.value;
    if (!q) return;
    api.queueCommandAutoplay(q.queue_id, enabled);
  };

  return {
    queue,
    radioSources,
    radioModeActive,
    autoplayEnabled,
    autoplayApplicable,
    setAutoplay,
  };
}
