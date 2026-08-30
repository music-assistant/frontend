import { serverNow } from "@/composables/useServerTime";
import { MediaType, PlaybackState, QueueItem } from "../plugins/api/interfaces";

/**
 * Calculate the current elapsed playback time in seconds from a stored
 * `elapsed_time` value and the `elapsed_time_last_updated` UTC timestamp
 * (seconds since epoch), on the server's clock. The function assumes:
 *  - elapsed_time: seconds (may be fractional)
 *  - elapsed_time_last_updated: seconds since epoch (UTC)
 *  - playback_speed: multiplier applied to the wall-clock delta (default 1)
 *
 * If `playbackState` is not PLAYING, the function returns the provided
 * `elapsed_time` without applying the time-delta. This avoids advancing the
 * position while paused/stopped.
 */
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
  // `elapsed_time_last_updated` is on the server's clock, so the delta is measured
  // against the server's clock too: on a device whose own clock is off, comparing the
  // two directly would offset the position by exactly that error.
  const delta = Math.max(0, serverNow() - elapsed_time_last_updated);

  return elapsed_time + delta * playback_speed;
}

/**
 * Speed a queue item plays at, e.g. an audiobook at 1.5x.
 *
 * Only a finite speed above zero is usable: zero would freeze every progress
 * indicator, a negative value would run them backwards, and the OS media
 * session rejects such a rate outright. Anything else reads as normal speed.
 */
export function queueItemPlaybackSpeed(item?: QueueItem | null): number {
  const speed = item?.extra_attributes?.playback_speed;
  return typeof speed === "number" && Number.isFinite(speed) && speed > 0
    ? speed
    : 1;
}

/** Whether a queue item plays at a speed of its own that can be changed. */
export function playbackSpeedSupported(item?: QueueItem | null): boolean {
  const mediaType = item?.media_item?.media_type;
  return (
    mediaType === MediaType.AUDIOBOOK || mediaType === MediaType.PODCAST_EPISODE
  );
}

/** Playback speed as it reads on screen, e.g. `1.5` for one and a half times. */
export function formatPlaybackSpeed(speed: number): string {
  return Number.isInteger(speed) ? speed.toFixed(1) : speed.toString();
}
