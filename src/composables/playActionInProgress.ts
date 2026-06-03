import { onUnmounted, ref, watch, type Ref } from "vue";
import type { PlayerQueue } from "@/plugins/api/interfaces";

// `play_action_in_progress` blips true for ~50ms during a seek (the stream
// restarts at the new position). Debouncing it means the dependent UI — the
// play-button spinner and the disabled state of the transport controls — only
// reacts to genuinely slow actions instead of flickering on every seek.
export function usePlayActionInProgress(
  playerQueue: Ref<PlayerQueue | undefined>,
  delay = 200,
) {
  const isLoading = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  watch(
    () => playerQueue.value?.extra_attributes?.play_action_in_progress === true,
    (inProgress) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (inProgress) {
        timer = setTimeout(() => (isLoading.value = true), delay);
      } else {
        isLoading.value = false;
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    if (timer) clearTimeout(timer);
  });

  return { isLoading };
}
