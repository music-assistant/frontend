import api from "@/plugins/api";
import { store } from "@/plugins/store";
import { computed } from "vue";

/**
 * Whether the active player's queue is still starting an earlier play action,
 * so a play button can wait for it. The queue is resolved directly, since
 * activePlayerQueue is undefined while an external source is active.
 */
export function usePlayActionInProgress() {
  return computed(() => {
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
}
