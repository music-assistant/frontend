<!--
  Inline lyrics sync-offset stepper for the fullscreen player's overflow menu.

  Rendered as a non-selectable row so the −/+ buttons adjust the offset in place
  without closing the menu; press-and-hold accelerates after a short delay.
-->
<template>
  <div class="lyrics-offset-row" @pointerdown.stop @click.stop>
    <ChevronsLeftRight :size="20" class="lyrics-offset-row__icon" />
    <span class="lyrics-offset-row__label">{{ $t("lyrics_offset") }}</span>
    <div class="lyrics-offset-row__stepper">
      <button
        type="button"
        class="lyrics-offset-row__btn"
        :aria-label="$t('tooltip.decrease_offset')"
        @click.stop
        @mousedown.stop="startRepeating(-0.1)"
        @touchstart.stop.prevent="startRepeating(-0.1)"
      >
        <Minus :size="16" />
      </button>
      <span class="lyrics-offset-row__value">{{ display }}s</span>
      <button
        type="button"
        class="lyrics-offset-row__btn"
        :aria-label="$t('tooltip.increase_offset')"
        @click.stop
        @mousedown.stop="startRepeating(0.1)"
        @touchstart.stop.prevent="startRepeating(0.1)"
      >
        <Plus :size="16" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useLyricsOffset } from "@/composables/lyrics/useLyricsOffset";
import { $t } from "@/plugins/i18n";
import { ChevronsLeftRight, Minus, Plus } from "@lucide/vue";
import { onBeforeUnmount } from "vue";

const { adjust, display } = useLyricsOffset();

// Press-and-hold: first step on press, then accelerate after a short delay.
let holdDelay: number | null = null;
let holdInterval: number | null = null;

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

const startRepeating = (delta: number) => {
  stopRepeating();
  adjust(delta);
  holdDelay = window.setTimeout(() => {
    holdInterval = window.setInterval(() => adjust(delta), 80);
  }, 400);
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
  min-width: 3.5ch;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
</style>
