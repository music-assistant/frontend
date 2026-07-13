/**
 * Composable for computing lyrics elapsed time using requestAnimationFrame.
 *
 * Provides a reactive `elapsedTime` ref that updates at ~60fps while playing,
 * suitable for smooth lyrics synchronization. Automatically starts/stops the
 * rAF loop based on playback state and an optional `enabled` guard.
 */

import { ref, watchEffect, onScopeDispose, type Ref } from "vue";
import { PlaybackState } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computeElapsedTime } from "@/helpers/elapsed";
import api from "@/plugins/api";

export function useLyricsElapsedTime(enabled?: Ref<boolean>) {
  const elapsedTime = ref(0);
  let rafId: number | null = null;

  const update = () => {
    const queue = store.activePlayerQueue;
    const queueId = queue?.queue_id;
    const queueTime = queueId ? api.queueElapsedTime[queueId] : undefined;
    if (
      queueTime?.elapsed_time != null &&
      queueTime?.elapsed_time_last_updated != null
    ) {
      elapsedTime.value =
        computeElapsedTime(
          queueTime.elapsed_time,
          queueTime.elapsed_time_last_updated,
          store.activePlayer?.playback_state,
        ) ?? 0;
    }
    rafId = requestAnimationFrame(update);
  };

  const start = () => {
    if (!rafId) {
      rafId = requestAnimationFrame(update);
    }
  };

  const stop = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
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
