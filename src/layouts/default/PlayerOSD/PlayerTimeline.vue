<template>
  <div style="width: auto; height: 24px">
    <div v-if="store.activePlayer" style="width: 100%">
      <div
        class="timeline-slider-wrapper"
        @touchstart="isThumbHidden = false"
        @touchend="isThumbHidden = true"
        @mouseenter="isThumbHidden = false"
        @mouseleave="isThumbHidden = true"
      >
        <input
          type="range"
          class="timeline-slider"
          :class="{ 'timeline-slider--no-thumb': isThumbHidden }"
          :value="curTimeValue"
          :disabled="!canSeek"
          :min="0"
          :max="store.activePlayer?.current_media?.duration || 0"
          :step="1"
          :style="sliderStyle"
          @input="onSliderInput"
          @mousedown="startDragging"
          @mouseup="stopDragging"
          @touchstart="startDragging"
          @touchend="stopDragging"
        />
        <!-- Chapter tick marks -->
        <div
          v-if="Object.keys(chapterTicks).length > 0"
          class="chapter-ticks"
        >
          <div
            v-for="(label, pos) in chapterTicks"
            :key="pos"
            class="chapter-tick"
            :style="{ left: tickPosition(Number(pos)) }"
          />
        </div>
        <!-- Chapter labels -->
        <div
          v-if="showLabels && !isThumbHidden && Object.keys(chapterTicks).length > 0 && Object.keys(chapterTicks).length < 6"
          class="chapter-labels"
        >
          <a
            v-for="(label, pos) in chapterTicks"
            :key="pos"
            class="text-caption chapter-label"
            :style="{ left: tickPosition(Number(pos)) }"
            @click="chapterClicked(Number(pos))"
          >{{ label }}</a>
        </div>
      </div>

      <div v-if="showLabels" class="time-text-row">
        <!-- current time detail -->
        <div
          class="text-caption time-text-left"
          @click="
            showRemainingTime
              ? (showRemainingTime = false)
              : (showRemainingTime = true)
          "
        >
          {{ playerCurTimeStr }}
        </div>

        <!-- end time detail -->
        <div class="text-caption time-text-right">
          {{ playerTotalTimeStr }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import api from "@/plugins/api";
import { MediaType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { useActiveSource } from "@/composables/activeSource";
import { formatDuration } from "@/helpers/utils";
import { ref, computed, watch, toRef, onUnmounted } from "vue";
import computeElapsedTime from "@/helpers/elapsed";

// properties
export interface Props {
  showLabels?: boolean;
  color?: string;
}

const compProps = withDefaults(defineProps<Props>(), {
  showLabels: false,
  color: undefined,
});

const { activeSource } = useActiveSource(toRef(store, "activePlayer"));

// local refs
const showRemainingTime = ref(false);
const isThumbHidden = ref(true);
const isDragging = ref(false);
const curTimeValue = ref(0);
const tempTime = ref(0);
// ticking ref to force recompute of elapsed time (Date.now() is non-reactive)
// rAF drives smooth 60fps slider movement; a 1s interval keeps text
// labels up-to-date when the tab is backgrounded (rAF pauses).
const nowTick = ref(0);
let rafId: number | null = null;
let fallbackTimer: ReturnType<typeof setInterval> | null = null;

const startTick = () => {
  if (rafId === null) {
    const tick = () => {
      const now = Date.now();
      if (now - nowTick.value >= 64) {
        nowTick.value = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }
  if (fallbackTimer === null) {
    fallbackTimer = setInterval(() => (nowTick.value = Date.now()), 1000);
  }
};

const stopTick = () => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (fallbackTimer !== null) {
    clearInterval(fallbackTimer);
    fallbackTimer = null;
  }
};

onUnmounted(() => {
  stopTick();
});

// computed properties
const canSeek = computed(() => {
  // Check if active source allows seeking
  if (activeSource.value) {
    // Only allow seeking if the source reports that it supports seeking
    // (can_seek) AND the current media has a known duration.
    if (store.activePlayer?.powered === false) return false;
    const currentMediaDuration = store.activePlayer?.current_media?.duration;
    const currentMediaHasDuration = !!currentMediaDuration;

    // Disallow seeking for radio streams (or other duration-less streams)
    const isRadio =
      store.activePlayer?.current_media?.media_type == MediaType.RADIO ||
      store.activePlayer?.current_media?.duration == null;
    if (isRadio) return false;

    // If the active source reports can_seek, allow seeking when there is a
    // duration available.
    if (activeSource.value.can_seek && currentMediaHasDuration) return true;
  }
  return false;
});

const playerCurTimeStr = computed(() => {
  if (curTimeValue.value != null) {
    if (
      showRemainingTime.value &&
      store.activePlayer?.current_media?.duration
    ) {
      const remaining =
        store.activePlayer.current_media.duration - curTimeValue.value;
      return `-${formatDuration(remaining)}`;
    }
    return formatDuration(curTimeValue.value);
  }
  return "0:00";
});

const playerTotalTimeStr = computed(() => {
  const duration = store.activePlayer?.current_media?.duration;
  // If radio/streaming with unknown duration, don't show
  if (
    !duration ||
    store.activePlayer?.current_media?.media_type == MediaType.RADIO
  )
    return "";
  return formatDuration(duration);
});

const computedElapsedTime = computed(() => {
  // include nowTick.value so this computed re-evaluates periodically while mounted
  // and updates UI for fallback player-level current_media that relies on Date.now()
  void nowTick.value;

  // Adaptive tick: only run the timer when we have a playing source that relies on time progression
  const isPlaying = store.activePlayer?.playback_state === "playing";
  const usingQueue = !!(
    store.activePlayerQueue && store.activePlayerQueue.active
  );
  const hasCurrentMedia =
    store.activePlayer?.current_media?.elapsed_time != null;

  // Start ticking when playing and either using queue or external current_media
  if (isPlaying && (usingQueue || hasCurrentMedia)) startTick();
  else stopTick();
  if (isDragging.value) {
    // eslint-disable-next-line vue/no-side-effects-in-computed-properties
    tempTime.value = curTimeValue.value;
    return curTimeValue.value;
  }

  // Prefer queue-level elapsed_time if available
  const queue = store.activePlayerQueue;
  if (queue?.elapsed_time != null && queue?.elapsed_time_last_updated != null) {
    const computed = computeElapsedTime(
      queue.elapsed_time,
      queue.elapsed_time_last_updated,
      queue.state,
    );
    return computed ?? 0;
  }

  // Fallback to player-level elapsed_time. This is used for external/3rd-party
  // sources currently playing on the player (not for Music Assistant queue
  // playback). Use the player-level fields when no activePlayerQueue is set.
  // Prefer current_media timing when available (external source playing on the player)
  if (
    store.activePlayer?.current_media?.elapsed_time != null &&
    store.activePlayer?.current_media?.elapsed_time_last_updated != null
  ) {
    const computed = computeElapsedTime(
      store.activePlayer.current_media.elapsed_time,
      store.activePlayer.current_media.elapsed_time_last_updated,
      store.activePlayer?.playback_state,
    );
    return computed ?? 0;
  }

  // Fall back to player-level elapsed_time (legacy / provider-level value)
  if (
    store.activePlayer?.elapsed_time != null &&
    store.activePlayer?.elapsed_time_last_updated != null
  ) {
    const computed = computeElapsedTime(
      store.activePlayer.elapsed_time,
      store.activePlayer.elapsed_time_last_updated,
      store.activePlayer?.playback_state,
    );
    return computed ?? 0;
  }

  return 0;
});

const sliderStyle = computed(() => {
  const max = store.activePlayer?.current_media?.duration || 1;
  const pct = max > 0 ? (curTimeValue.value / max) * 100 : 0;
  return {
    '--timeline-color': compProps.color || 'currentColor',
    '--timeline-pct': `${pct}%`,
  } as Record<string, string>;
});

const tickPosition = (pos: number) => {
  const max = store.activePlayer?.current_media?.duration || 1;
  return `${(pos / max) * 100}%`;
};

const onSliderInput = (e: Event) => {
  const val = Number((e.target as HTMLInputElement).value);
  curTimeValue.value = val;
};

const chapterTicks = computed(() => {
  const ticks: Record<number, string> = {};
  if (store.curQueueItem?.media_item?.metadata?.chapters) {
    store.curQueueItem.media_item.metadata.chapters.forEach((chapter) => {
      ticks[chapter.start] = chapter.name;
    });
  }
  return ticks;
});

//watch
watch(computedElapsedTime, (newTime) => {
  if (!isDragging.value) {
    curTimeValue.value = newTime;
  }
});

// methods
const startDragging = function () {
  isDragging.value = true;
};

const stopDragging = () => {
  isDragging.value = false;
  if (!isDragging.value && store.activePlayer) {
    api.playerCommandSeek(
      store.activePlayer.player_id,
      Math.round(tempTime.value),
    );
  }
};

const chapterClicked = function (chaperPos: number) {
  if (store.curQueueItem?.media_item?.metadata?.chapters) {
    for (const chapter of store.curQueueItem.media_item.metadata.chapters) {
      if (chapter.start == chaperPos) {
        api.playMedia(
          store.curQueueItem.media_item.uri,
          undefined,
          undefined,
          chapter.position.toString(),
        );
        return;
      }
    }
  }
};
</script>

<style scoped>
.timeline-slider-wrapper {
  position: relative;
  width: 100%;
  height: 24px;
  display: flex;
  align-items: center;
}

.timeline-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  background: linear-gradient(
    to right,
    var(--timeline-color, currentColor) var(--timeline-pct, 0%),
    rgba(128, 128, 128, 0.24) var(--timeline-pct, 0%)
  );
}

.timeline-slider:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.timeline-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--timeline-color, currentColor);
  cursor: pointer;
  transition: width 0.15s, height 0.15s;
}

.timeline-slider--no-thumb::-webkit-slider-thumb {
  width: 0;
  height: 0;
}

.timeline-slider::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--timeline-color, currentColor);
  border: none;
  cursor: pointer;
}

.timeline-slider--no-thumb::-moz-range-thumb {
  width: 0;
  height: 0;
}

.chapter-ticks {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  pointer-events: none;
}

.chapter-tick {
  position: absolute;
  width: 2px;
  height: 8px;
  background: var(--timeline-color, currentColor);
  opacity: 0.6;
  transform: translate(-50%, -50%);
  top: 50%;
}

.chapter-labels {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
}

.chapter-label {
  position: absolute;
  transform: translateX(-50%);
  font-size: 10px;
  cursor: pointer;
  white-space: nowrap;
}

.time-text-left {
  text-align: left;
  display: table-cell;
}
.time-text-right {
  text-align: right;
  display: table-cell;
  right: 0;
}
.time-text-row {
  cursor: pointer;
  height: 8px;
  flex-basis: 0;
  flex-grow: 1;
  max-width: 100%;
  opacity: 0.6;
  display: flex;
  flex: 1 1 auto;
  margin-top: -10px;
  margin-bottom: 5px;
}
.time-text-row > div {
  width: calc(100% / 2);
}
</style>
