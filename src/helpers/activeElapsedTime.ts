/**
 * Playback position of whatever is currently playing on the active player.
 *
 * Resolves the timing source, its playback state and the playback speed in one
 * place, so progress indicators do not each work the position out differently.
 * Both functions read the current values on each call and hold no state, which
 * makes them equally usable inside a `computed` and inside a rAF/interval loop.
 */
import { computeElapsedTime, queueItemPlaybackSpeed } from "@/helpers/elapsed";
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import { PlaybackState } from "@/plugins/api/interfaces";

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
 * The timing source for the active player, or undefined when none reports a position.
 *
 * Each source is paired with the playback state that belongs to it, so callers
 * never combine a queue position with a player state or the other way around.
 */
export function resolveActiveTiming(): ActiveTiming | undefined {
  const playbackSpeed = queueItemPlaybackSpeed(store.curQueueItem);

  // Prefer the active queue's own elapsed_time when it reports one.
  const queue = store.activePlayerQueue;
  if (queue) {
    const queueTime = api.queueElapsedTime[queue.queue_id];
    if (
      queueTime?.elapsed_time != null &&
      queueTime.elapsed_time_last_updated != null
    ) {
      return {
        elapsedTime: queueTime.elapsed_time,
        lastUpdated: queueTime.elapsed_time_last_updated,
        playbackState: queue.state,
        playbackSpeed,
      };
    }
  }

  // Fall back to the player's own timing, which is what external/3rd-party
  // sources playing on the player report: current_media first, then the legacy
  // player-level fields.
  const player = store.activePlayer;
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
 * The current playback position of the active player in seconds, or undefined
 * when no timing source is available.
 */
export function resolveActiveElapsedTime(): number | undefined {
  const timing = resolveActiveTiming();
  if (!timing) return undefined;

  return computeElapsedTime(
    timing.elapsedTime,
    timing.lastUpdated,
    timing.playbackState,
    timing.playbackSpeed,
  );
}
