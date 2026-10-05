import { playbackSpeedSupported } from "@/helpers/elapsed";
import { store } from "@/plugins/store";
import { computed } from "vue";

export const SKIP_BACK_SECONDS = 10;
export const SKIP_FORWARD_SECONDS = 30;

/**
 * Whether the skip back and skip forward buttons take the place of shuffle and
 * repeat: while an audiobook or podcast episode plays.
 */
export function useSkipControls() {
  const showSkip = computed(() => playbackSpeedSupported(store.curQueueItem));
  return { showSkip };
}
