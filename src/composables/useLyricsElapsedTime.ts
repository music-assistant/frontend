/**
 * Composable for computing lyrics elapsed time using setInterval.
 *
 * Provides a reactive `elapsedTime` ref that updates at ~150ms intervals
 * while playing — enough precision for the 0.5s CSS lead-time on line
 * transitions and smooth musical-break note fills, without the overhead
 * of a 60fps rAF loop. Automatically starts/stops the timer based on
 * playback state and an optional `enabled` guard.
 */

import { ref, watchEffect, onScopeDispose, type Ref } from "vue";
import { PlaybackState } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computeElapsedTime } from "@/helpers/elapsed";

/** Interval between elapsed-time updates (ms). */
const TICK_INTERVAL = 150;

export function useLyricsElapsedTime(enabled?: Ref<boolean>) {
  const elapsedTime = ref(0);
  let timerId: ReturnType<typeof setInterval> | null = null;

  const update = () => {
    const queue = store.activePlayerQueue;
    if (
      queue?.elapsed_time != null &&
      queue?.elapsed_time_last_updated != null
    ) {
      elapsedTime.value =
        computeElapsedTime(
          queue.elapsed_time,
          queue.elapsed_time_last_updated,
          store.activePlayer?.playback_state,
        ) ?? 0;
    }
  };

  const start = () => {
    if (!timerId) {
      update();
      timerId = setInterval(update, TICK_INTERVAL);
    }
  };

  const stop = () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  };

  // Track whether the loop *should* be running so visibility changes
  // can pause/resume without fighting the watchEffect.
  let shouldRun = false;

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible" && shouldRun) {
      start();
    } else {
      stop();
    }
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);

  watchEffect(() => {
    const playing =
      store.activePlayer?.playback_state === PlaybackState.PLAYING;
    const queue = store.activePlayerQueue;
    const isEnabled = enabled ? enabled.value : true;

    shouldRun = playing && !!queue?.active && isEnabled;

    if (shouldRun && document.visibilityState === "visible") {
      start();
    } else {
      stop();
    }
  });

  onScopeDispose(() => {
    stop();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  });

  return { elapsedTime, start, stop };
}
