import api from "@/plugins/api";
import { store } from "@/plugins/store";
import { computed } from "vue";

/**
 * Whether a play action of the active player is still running, so a play button
 * can wait for it. A grouped or synced player's play request runs on its own queue
 * or on the queue it plays from, so both count. The queues are looked up
 * directly, since activePlayerQueue is undefined while an external source is active.
 */
export function usePlayActionInProgress() {
  return computed(() => {
    const player = store.activePlayer;
    if (!player) return false;
    return [player.player_id, player.active_source].some(
      (queueId) =>
        !!queueId &&
        api.queues[queueId]?.extra_attributes?.play_action_in_progress === true,
    );
  });
}
