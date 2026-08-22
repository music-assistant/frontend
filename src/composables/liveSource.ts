import { computed, ComputedRef, Ref, unref } from "vue";
import { useActiveSource } from "@/composables/activeSource";
import { Player, PlayerQueue, PlayerSource } from "@/plugins/api/interfaces";

type MaybeRef<T> = ComputedRef<T> | Ref<T> | T;

/**
 * Composable that exposes the live external source playing on a player in place
 * of a queue, or undefined when Music Assistant's own queue is what is playing.
 *
 * A source that takes the player over (Spotify Connect, AirPlay, Ynison, …) is
 * attached to no queue, so the commands it can handle reach its own session
 * through the player and the state to render comes off the source itself.
 */
export function useLiveSource(
  player: MaybeRef<Player | undefined>,
  playerQueue: MaybeRef<PlayerQueue | undefined>,
) {
  const { activeSource } = useActiveSource(player);

  const liveSource = computed((): PlayerSource | undefined => {
    // a resolved queue means Music Assistant owns the playback
    if (unref(playerQueue)) return undefined;
    // the MA queue is always in the source list, so a player sitting on its own
    // queue would otherwise resolve to it through the player_id fallback
    if (!unref(player)?.active_source) return undefined;
    return activeSource.value;
  });

  return { liveSource };
}
