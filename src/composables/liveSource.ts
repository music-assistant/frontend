import { computed, type MaybeRef, unref } from "vue";
import { useActiveSource } from "@/composables/activeSource";
import { Player, PlayerQueue, PlayerSource } from "@/plugins/api/interfaces";

/**
 * Composable that exposes the live external source playing on a player in place
 * of a queue, or undefined when Music Assistant's own queue is what is playing.
 *
 * A source that takes the player over (Spotify Connect, AirPlay, Ynison, …) is
 * attached to no queue, so the commands it can handle reach its own session
 * through the player and the state to render comes off the source itself.
 *
 * Unlike `useActiveSource`, which answers with whichever source list entry is
 * active and so happily returns the Music Assistant queue's own entry, this
 * narrows to a source that has genuinely taken the player over — the caller
 * routes a command on the answer rather than merely greying a button out, and
 * sending an MA queue's shuffle to the player command would be wrong.
 *
 * Pass the queue that belongs to the same player, i.e. `resolvePlayerQueue(player)`.
 */
export function useLiveSource(
  player: MaybeRef<Player | undefined>,
  playerQueue: MaybeRef<PlayerQueue | undefined>,
) {
  const { activeSource } = useActiveSource(player);

  const liveSource = computed((): PlayerSource | undefined => {
    // a resolved queue means Music Assistant owns the playback
    if (unref(playerQueue)) return undefined;
    const playerObj = unref(player);
    // nothing selected: useActiveSource would fall back to the player's own id
    if (!playerObj?.active_source) return undefined;
    // the MA queue is always in the source list under the player's own id, and
    // a live source is always there under its uri — so this is the own queue,
    // reachable before its queue has arrived in the client's state
    if (playerObj.active_source === playerObj.player_id) return undefined;
    return activeSource.value;
  });

  return { liveSource };
}
