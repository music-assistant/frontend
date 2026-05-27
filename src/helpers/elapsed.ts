/**
 * computeElapsedTime
 *
 * Calculate the current elapsed playback time in seconds from a stored
 * `elapsed_time` value and the `elapsed_time_last_updated` UTC timestamp
 * (seconds since epoch). The function assumes:
 *  - elapsed_time: seconds (may be fractional)
 *  - elapsed_time_last_updated: seconds since epoch (UTC)
 *  - playback_speed: multiplier applied to the wall-clock delta (default 1)
 *
 * If `playbackState` is not PLAYING, the function returns the provided
 * `elapsed_time` without applying the time-delta. This avoids advancing the
 * position while paused/stopped.
 */
import { PlaybackState } from "../plugins/api/interfaces";

export function computeElapsedTime(
  elapsed_time: number | undefined,
  elapsed_time_last_updated: number | undefined,
  playbackState?: PlaybackState,
  playback_speed: number = 1,
): number | undefined {
  if (elapsed_time === undefined || elapsed_time_last_updated === undefined) {
    return elapsed_time;
  }

  // Only advance the elapsed time when the player is actually playing.
  if (playbackState !== undefined && playbackState !== PlaybackState.PLAYING) {
    return elapsed_time;
  }
  // The server sends `elapsed_time_last_updated` in seconds since epoch.
  // Convert to milliseconds for Date.now() math.
  const lastUpdatedMs = elapsed_time_last_updated * 1000;

  const nowMs = Date.now();
  const deltaMs = Math.max(0, nowMs - lastUpdatedMs);
  const deltaSeconds = (deltaMs / 1000) * playback_speed;

  return elapsed_time + deltaSeconds;
}

export default computeElapsedTime;
