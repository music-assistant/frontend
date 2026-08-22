// Shared reactive state for the queue's "keep playing" behaviour — dynamic mode
// (the queue refills itself from one or more dynamic sources, e.g. a radio
// playlist) and autoplay (more tracks are appended when a finite queue runs
// out). The fullscreen header controls and the queue mode banner both read
// these, so the (mutually exclusive) logic lives in one place instead of being
// duplicated per component.
import api from "@/plugins/api";
import { isQueueInfiniteStream } from "@/plugins/api/helpers";
import type { ItemMapping } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computed } from "vue";

export function useQueueModes() {
  const queue = computed(() => store.activePlayerQueue);

  // Dynamic mode: the queue is being filled on the fly from its sources, with
  // autoplay and smart shuffle implicitly on. `sources` are the parent items
  // (seeds) the queue is playing from.
  const sources = computed<ItemMapping[]>(() => queue.value?.sources ?? []);
  const dynamicModeActive = computed(() => queue.value?.is_dynamic === true);

  // Autoplay: keeps the music going by appending more tracks when the queue
  // runs out.
  const autoplayEnabled = computed(
    () => queue.value?.autoplay_enabled === true,
  );

  // Autoplay only applies to an active queue playing regular tracks, and is
  // moot while dynamic mode is active (the queue already refills itself) or for
  // infinite streams.
  const autoplayApplicable = computed(() => {
    const q = queue.value;
    if (!q || !q.active) return false;
    if (isQueueInfiniteStream(q)) return false;
    if (dynamicModeActive.value) return false;
    return "autoplay_enabled" in q;
  });

  const setAutoplay = (enabled: boolean) => {
    const q = queue.value;
    if (!q) return;
    api.queueCommandAutoplay(q.queue_id, enabled);
  };

  return {
    queue,
    sources,
    dynamicModeActive,
    autoplayEnabled,
    autoplayApplicable,
    setAutoplay,
  };
}
