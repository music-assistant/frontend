/**
 * Composable for computing lyrics elapsed time using requestAnimationFrame.
 *
 * Provides a reactive `elapsedTime` ref that updates at ~60fps while playing,
 * suitable for smooth lyrics synchronization. Automatically starts/stops the
 * rAF loop based on the active queue's playback state and an optional
 * `enabled` guard.
 *
 * The position comes from that same queue, matching where its consumers take the
 * lyrics from: the queue's current item. A source playing on the player outside a
 * Music Assistant queue leaves them without lyrics, so there is nothing to
 * synchronize either.
 */

import { ref, watch, watchEffect, onScopeDispose, type Ref } from "vue";
import { PlaybackState } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { resolveQueueElapsedTime } from "@/helpers/activeElapsedTime";

export function useLyricsElapsedTime(enabled?: Ref<boolean>) {
  const elapsedTime = ref(0);
  let rafId: number | null = null;

  // Keeps the last known position when the queue reports no position, so the
  // lyrics do not snap back to the start of the track.
  const syncPosition = () => {
    const elapsed = resolveQueueElapsedTime();
    if (elapsed !== undefined) {
      elapsedTime.value = elapsed;
    }
  };

  const update = () => {
    syncPosition();
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

  // A gated consumer renders the moment `enabled` flips, so it gets a position
  // straight away rather than one frame late — and while the queue is paused no
  // frame comes at all. The callback is untracked, keeping the high-frequency
  // position out of the gate below.
  watch(
    () => enabled?.value ?? true,
    (isEnabled) => {
      if (isEnabled) syncPosition();
    },
    { immediate: true },
  );

  // The queue's own state and active flag both change rarely, unlike the resolved
  // position: that is backed by a high-frequency reactive map, so reading it here
  // would re-run the gate on every server timing push. The resolver checks
  // `active` as well, for the position it returns; here it decides whether the
  // loop burns frames at all.
  watchEffect(() => {
    const queue = store.activePlayerQueue;
    const playing = queue?.state === PlaybackState.PLAYING;
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

  return { elapsedTime };
}
