import { computed, type MaybeRef, unref } from "vue";
import { Player, PlayerQueue, PlayerSource } from "@/plugins/api/interfaces";

/**
 * The source playing on a player in place of a queue, or undefined when Music
 * Assistant's own queue is what is playing.
 *
 * Covers any source that is not the queue, whichever side provides it: one
 * Music Assistant bridges as a live session (Spotify Connect, AirPlay, Ynison,
 * …) and one the device runs natively alike. Either way there is no queue to
 * read from, so what the control can do and what it shows both come off the
 * source entry itself.
 *
 * Unlike `useActiveSource`, which answers with whichever source list entry is
 * active and so happily returns the Music Assistant queue's own entry, this
 * narrows to a source that has genuinely taken the player over — callers read
 * what a control shows off the answer, and a queue's own state lives on the
 * PlayerQueue rather than on its source entry.
 *
 * Pass the queue belonging to the same player, i.e. `resolvePlayerQueue(player)`.
 */
export function resolveExternalSource(
  player: Player | undefined,
  playerQueue: PlayerQueue | undefined,
): PlayerSource | undefined {
  // a resolved queue means Music Assistant owns the playback
  if (playerQueue) return undefined;
  if (!player?.active_source) return undefined;
  // the MA queue is always in the source list under the player's own id, and an
  // external source is always there under its uri — so this is the own queue,
  // reachable before that queue has arrived in the client's state
  if (player.active_source === player.player_id) return undefined;
  return player.source_list?.find(
    (source) => source.id === player.active_source,
  );
}

/** Reactive {@link resolveExternalSource}, for components tracking a player. */
export function useExternalSource(
  player: MaybeRef<Player | undefined>,
  playerQueue: MaybeRef<PlayerQueue | undefined>,
) {
  const externalSource = computed(() =>
    resolveExternalSource(unref(player), unref(playerQueue)),
  );

  return { externalSource };
}
