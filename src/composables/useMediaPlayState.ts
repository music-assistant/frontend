import { usePlayActionInProgress } from "@/composables/usePlayActionInProgress";
import api, { ConnectionState } from "@/plugins/api";
import { computed } from "vue";

/** Connection and pending queue commands for media-card playback. */
export function useMediaPlayState() {
  const connected = computed(
    () => api.state.value === ConnectionState.INITIALIZED,
  );
  const playActionInProgress = usePlayActionInProgress();
  return { connected, playActionInProgress };
}
