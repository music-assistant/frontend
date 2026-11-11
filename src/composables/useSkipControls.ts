import { playbackSpeedSupported } from "@/helpers/elapsed";
import { store } from "@/plugins/store";
import { computed } from "vue";

export const SKIP_BACK_SECONDS = 10;
export const SKIP_FORWARD_SECONDS = 30;

/**
 * Whether skip back and skip forward take the place of shuffle, repeat and the
 * default media key seek: while an audiobook or podcast episode plays.
 */
export function useSkipControls() {
  const showSkip = computed(() => playbackSpeedSupported(store.curQueueItem));
  return { showSkip };
}
