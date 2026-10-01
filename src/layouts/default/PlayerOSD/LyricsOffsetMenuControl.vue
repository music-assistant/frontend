<!--
  Inline lyrics sync-offset stepper for the fullscreen player's overflow menu.

  Rendered as a non-selectable row so the −/+ buttons adjust the offset in place
  without closing the menu; press-and-hold accelerates after a short delay.
-->
<template>
  <div class="lyrics-offset-row" @pointerdown.stop @click.stop>
    <ChevronsLeftRight :size="20" class="lyrics-offset-row__icon" />
    <span class="lyrics-offset-row__label">{{ $t(offsetLabel) }}</span>
    <div class="lyrics-offset-row__stepper">
      <button
        type="button"
        class="lyrics-offset-row__btn"
        :aria-label="$t('tooltip.decrease_offset')"
        @click.stop
        @mousedown.stop="startRepeating(-1)"
        @touchstart.stop.prevent="startRepeating(-1)"
      >
        <Minus :size="16" />
      </button>
      <span class="lyrics-offset-row__value">{{ display }}s</span>
      <button
        type="button"
        class="lyrics-offset-row__btn"
        :aria-label="$t('tooltip.increase_offset')"
        @click.stop
        @mousedown.stop="startRepeating(1)"
        @touchstart.stop.prevent="startRepeating(1)"
      >
        <Plus :size="16" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useLyricsOffset } from "@/composables/lyrics/useLyricsOffset";
import { MediaType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { ChevronsLeftRight, Minus, Plus } from "@lucide/vue";
import { computed, onBeforeUnmount } from "vue";

const { adjust, display } = useLyricsOffset();

// The same stepper shifts a track's lyrics and an episode's transcript.
const offsetLabel = computed(() =>
  store.curQueueItem?.media_item?.media_type === MediaType.PODCAST_EPISODE
    ? "transcript_offset"
    : "lyrics_offset",
);

// Press-and-hold: first step on press, then repeat on a fixed tick with a step
// that grows the longer the button is held, so the far end of the range stays
// reachable without dozens of clicks.
const HOLD_DELAY = 400;
const HOLD_TICK = 80;
const BASE_STEP = 0.1;
const HOLD_RAMP = [
  { heldFor: 3000, step: 1 },
  { heldFor: 1500, step: 0.5 },
];

let holdDelay: number | null = null;
let holdInterval: number | null = null;
let holdStart = 0;

const holdStep = () => {
  const held = performance.now() - holdStart;
  return HOLD_RAMP.find((stage) => held >= stage.heldFor)?.step ?? BASE_STEP;
};

const stopRepeating = () => {
  if (holdDelay !== null) {
    clearTimeout(holdDelay);
    holdDelay = null;
  }
  if (holdInterval !== null) {
    clearInterval(holdInterval);
    holdInterval = null;
  }
  window.removeEventListener("mouseup", stopRepeating);
  window.removeEventListener("touchend", stopRepeating);
  window.removeEventListener("touchcancel", stopRepeating);
};

const startRepeating = (direction: number) => {
  stopRepeating();
  holdStart = performance.now();
  adjust(direction * BASE_STEP);
  holdDelay = window.setTimeout(() => {
    holdInterval = window.setInterval(
      () => adjust(direction * holdStep()),
      HOLD_TICK,
    );
  }, HOLD_DELAY);
  window.addEventListener("mouseup", stopRepeating);
  window.addEventListener("touchend", stopRepeating);
  window.addEventListener("touchcancel", stopRepeating);
};

onBeforeUnmount(stopRepeating);
</script>

<style scoped>
.lyrics-offset-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 8px;
  font-size: 0.875rem;
}

.lyrics-offset-row__icon {
  flex: 0 0 auto;
}

.lyrics-offset-row__label {
  flex: 1 1 auto;
  min-width: 0;
}

.lyrics-offset-row__stepper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.lyrics-offset-row__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 6px;
  color: inherit;
  transition: background-color 0.12s ease;
}

.lyrics-offset-row__btn:hover {
  background: var(--accent);
}

.lyrics-offset-row__value {
  min-width: 6.5ch;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
</style>
