import { computed, type MaybeRef, unref } from "vue";
import { Player, PlayerQueue, PlayerSource } from "@/plugins/api/interfaces";

/**
 * The live external source playing on a player in place of a queue, or
 * undefined when Music Assistant's own queue is what is playing.
 *
 * A source that takes the player over (Spotify Connect, AirPlay, Ynison, …) is
 * attached to no queue, so the commands it can handle reach its own session
 * through the player and the state to render comes off the source itself.
 *
 * Unlike `useActiveSource`, which answers with whichever source list entry is
 * active and so happily returns the Music Assistant queue's own entry, this
 * narrows to a source that has genuinely taken the player over — callers route
 * a command on the answer rather than merely greying a control out, and sending
 * an MA queue's shuffle to the player command would be wrong.
 *
 * Pass the queue belonging to the same player, i.e. `resolvePlayerQueue(player)`.
 */
export function resolveLiveSource(
  player: Player | undefined,
  playerQueue: PlayerQueue | undefined,
): PlayerSource | undefined {
  // a resolved queue means Music Assistant owns the playback
  if (playerQueue) return undefined;
  if (!player?.active_source) return undefined;
  // the MA queue is always in the source list under the player's own id, and a
  // live source is always there under its uri — so this is the own queue,
  // reachable before that queue has arrived in the client's state
  if (player.active_source === player.player_id) return undefined;
  return player.source_list?.find(
    (source) => source.id === player.active_source,
  );
}

/** Reactive {@link resolveLiveSource}, for components tracking a player. */
export function useLiveSource(
  player: MaybeRef<Player | undefined>,
  playerQueue: MaybeRef<PlayerQueue | undefined>,
) {
  const liveSource = computed(() =>
    resolveLiveSource(unref(player), unref(playerQueue)),
  );

  return { liveSource };
}
