import api, { ConnectionState } from "@/plugins/api";
import { store } from "@/plugins/store";
import { computed } from "vue";

/** Connection and pending queue commands for media-card playback. */
export function useMediaPlayState() {
  const connected = computed(
    () => api.state.value === ConnectionState.INITIALIZED,
  );
  const playActionInProgress = computed(() => {
    const player = store.activePlayer;
    if (!player) return false;
    const queueId =
      player.active_source && player.active_source in api.queues
        ? player.active_source
        : player.player_id;
    return (
      api.queues[queueId]?.extra_attributes?.play_action_in_progress === true
    );
  });
  return { connected, playActionInProgress };
}
