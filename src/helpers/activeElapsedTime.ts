/**
 * Playback position of whatever is currently playing on a player.
 *
 * Resolves the timing source, its playback state and the playback speed in one
 * place, so progress indicators do not each work the position out differently.
 * The `resolveQueue*` variants narrow that to the player's active queue, for
 * consumers that only render what that queue is playing. Every function reads
 * the current values on each call and holds no state, which makes them equally
 * usable inside a `computed` and inside a rAF/interval loop.
 *
 * Every function defaults to the active player; pass a `player_id` to resolve
 * another player, such as the one an OS media session targets.
 */
import { computeElapsedTime, queueItemPlaybackSpeed } from "@/helpers/elapsed";
import api from "@/plugins/api";
import { resolvePlayerQueue } from "@/plugins/api/helpers";
import { store } from "@/plugins/store";
import { PlaybackState, Player, QueueItem } from "@/plugins/api/interfaces";

export interface ActiveTiming {
  elapsedTime: number;
  lastUpdated: number;
  playbackState: PlaybackState;
  /**
   * Speed the current queue item plays at, e.g. an audiobook at 1.5x. It applies
   * to every source, because the player is playing that same item.
   */
  playbackSpeed: number;
}

/**
 * The timing source for a player, or undefined when none reports a position.
 *
 * Each source is paired with the playback state that belongs to it, so callers
 * never combine a queue position with a player state or the other way around.
 */
export function resolveActiveTiming(
  player_id?: string,
): ActiveTiming | undefined {
  // Prefer the active queue's own elapsed_time when it reports one.
  const queueTiming = resolveQueueTiming(player_id);
  if (queueTiming) return queueTiming;

  // Fall back to the player's own timing, which is what external/3rd-party
  // sources playing on the player report: current_media first, then the legacy
  // player-level fields.
  const player = resolvePlayer(player_id);
  const playbackSpeed = queueItemPlaybackSpeed(resolveCurrentItem(player));
  // An unknown state must not extrapolate from the last update.
  const playerState = player?.playback_state ?? PlaybackState.IDLE;
  if (
    player?.current_media?.elapsed_time != null &&
    player.current_media.elapsed_time_last_updated != null
  ) {
    return {
      elapsedTime: player.current_media.elapsed_time,
      lastUpdated: player.current_media.elapsed_time_last_updated,
      playbackState: playerState,
      playbackSpeed,
    };
  }

  if (
    player?.elapsed_time != null &&
    player.elapsed_time_last_updated != null
  ) {
    return {
      elapsedTime: player.elapsed_time,
      lastUpdated: player.elapsed_time_last_updated,
      playbackState: playerState,
      playbackSpeed,
    };
  }

  return undefined;
}

/**
 * The timing reported by a player's active queue, or undefined when there is no
 * such queue or it reports no position.
 *
 * Use this rather than `resolveActiveTiming` for consumers that take their content
 * from that queue's current item: the player fallback would hand them a position
 * for content they cannot display.
 */
export function resolveQueueTiming(
  player_id?: string,
): ActiveTiming | undefined {
  const queue = resolvePlayerQueue(resolvePlayer(player_id));
  // An inactive queue holds the position it stopped at, while its current item is
  // already gone; pairing the two would mix a stale position with a default speed.
  if (!queue?.active) return undefined;

  const queueTime = api.queueElapsedTime[queue.queue_id];
  if (
    queueTime?.elapsed_time == null ||
    queueTime.elapsed_time_last_updated == null
  ) {
    return undefined;
  }

  return {
    elapsedTime: queueTime.elapsed_time,
    lastUpdated: queueTime.elapsed_time_last_updated,
    playbackState: queue.state,
    playbackSpeed: queueItemPlaybackSpeed(queue.current_item),
  };
}

/**
 * The current playback position of a player in seconds, or undefined when no
 * timing source is available.
 */
export function resolveActiveElapsedTime(
  player_id?: string,
): number | undefined {
  return toElapsedTime(resolveActiveTiming(player_id));
}

/**
 * The current playback position of a player's active queue in seconds, or
 * undefined when there is no such queue or it reports no timing.
 */
export function resolveQueueElapsedTime(
  player_id?: string,
): number | undefined {
  return toElapsedTime(resolveQueueTiming(player_id));
}

function resolvePlayer(player_id?: string): Player | undefined {
  if (player_id === undefined) return store.activePlayer;
  return api.players[player_id];
}

function resolveCurrentItem(player?: Player): QueueItem | undefined {
  const queue = resolvePlayerQueue(player);
  return queue?.active ? queue.current_item : undefined;
}

function toElapsedTime(timing: ActiveTiming | undefined): number | undefined {
  if (!timing) return undefined;

  return computeElapsedTime(
    timing.elapsedTime,
    timing.lastUpdated,
    timing.playbackState,
    timing.playbackSpeed,
  );
}
