import { computed, ComputedRef, Ref } from "vue";
import { AudioSource, Player } from "@/plugins/api/interfaces";
import { isAudioSource } from "@/plugins/api/helpers";
import { store } from "@/plugins/store";

/**
 * Composable that exposes the AudioSource currently playing on a player,
 * or undefined when the active queue item is not an AudioSource.
 */
export function useActiveAudioSource(
  player:
    | ComputedRef<Player | undefined>
    | Ref<Player | undefined>
    | Player
    | undefined,
) {
  const activeAudioSource = computed((): AudioSource | undefined => {
    const playerObj =
      typeof player === "object" && "value" in player ? player.value : player;
    if (!playerObj) return undefined;
    const item = store.curQueueItem?.media_item;
    return isAudioSource(item) ? item : undefined;
  });

  return { activeAudioSource };
}
