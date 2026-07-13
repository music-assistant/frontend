/**
 * Shared lyrics latency offset (in seconds).
 *
 * Adjusted from the fullscreen player's overflow menu while lyrics are open and
 * fed to the lyrics viewer. Module-level state so the value persists across
 * track changes (and fullscreen open/close) within the session.
 */

import { computed, ref } from "vue";

const MIN_OFFSET = -9.9;
const MAX_OFFSET = 9.9;

const offset = ref(0);

export function useLyricsOffset() {
  const adjust = (delta: number) => {
    const next = Math.round((offset.value + delta) * 10) / 10;
    offset.value = Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, next));
  };

  const reset = () => {
    offset.value = 0;
  };

  // Signed, one-decimal display (e.g. "+0.5", "0.0", "-1.2").
  const display = computed(() => {
    const sign = offset.value > 0 ? "+" : "";
    return `${sign}${offset.value.toFixed(1)}`;
  });

  return { offset, adjust, reset, display };
}
