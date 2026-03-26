<template>
  <div style="width: auto; height: 24px">
    <div v-if="store.activePlayer" style="width: 100%">
      <!-- GPU-accelerated custom slider — uses transform: scaleX / translateX
           instead of Vuetify's width / inset-inline-start to stay on the
           compositor thread during rAF-driven playback updates. -->
      <div
        ref="sliderEl"
        class="timeline-slider"
        :class="{ 'timeline-slider--disabled': !canSeek }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @mouseenter="isThumbHidden = false"
        @mouseleave="onMouseLeave"
        @touchstart.passive="isThumbHidden = false"
        @touchend="isThumbHidden = true"
      >
        <div class="timeline-track">
          <div class="timeline-fill" :style="fillStyle"></div>
          <div
            v-for="(label, pos) in chapterTicks"
            :key="pos"
            class="timeline-tick"
            :style="{ left: `${tickPercent(Number(pos))}%` }"
            @click.stop="chapterClicked(Number(pos))"
          >
            <span
              v-if="
                showLabels &&
                !isThumbHidden &&
                Object.values(chapterTicks).length < 6
              "
              class="timeline-tick-label text-caption"
              >{{ label }}</span
            >
          </div>
        </div>
        <div
          class="timeline-thumb"
          :class="{ 'timeline-thumb--hidden': isThumbHidden }"
          :style="thumbStyle"
        ></div>
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

const props = withDefaults(defineProps<Props>(), {
  showLabels: false,
  color: undefined,
});

const { activeSource } = useActiveSource(toRef(store, "activePlayer"));

// template refs
const sliderEl = ref<HTMLElement>();

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

// -- Reactive slider styles (GPU-only transforms) ---------------------------
const progressFraction = computed(() => {
  const dur = duration.value;
  return dur > 0 ? Math.min(Math.max(curTimeValue.value / dur, 0), 1) : 0;
});

const fillStyle = computed(() => ({
  transform: `scaleX(${progressFraction.value})`,
  ...(props.color ? { backgroundColor: props.color } : {}),
}));

const thumbStyle = computed(() => ({
  left: `${progressFraction.value * 100}%`,
  ...(props.color ? { backgroundColor: props.color } : {}),
}));

// -- Computed properties -----------------------------------------------------
const canSeek = computed(() => {
  if (activeSource.value) {
    if (store.activePlayer?.powered === false) return false;
    const currentMediaDuration = store.activePlayer?.current_media?.duration;
    const currentMediaHasDuration = !!currentMediaDuration;
    const isRadio =
      store.activePlayer?.current_media?.media_type == MediaType.RADIO ||
      store.activePlayer?.current_media?.duration == null;
    if (isRadio) return false;
    if (activeSource.value.can_seek && currentMediaHasDuration) return true;
  }
  return false;
});

const duration = computed(
  () => store.activePlayer?.current_media?.duration || 0,
);

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
  const dur = store.activePlayer?.current_media?.duration;
  if (!dur || store.activePlayer?.current_media?.media_type == MediaType.RADIO)
    return "";
  return formatDuration(dur);
});

const computedElapsedTime = computed(() => {
  void nowTick.value;

  const isPlaying = store.activePlayer?.playback_state === "playing";
  const usingQueue = !!(
    store.activePlayerQueue && store.activePlayerQueue.active
  );
  const hasCurrentMedia =
    store.activePlayer?.current_media?.elapsed_time != null;

  if (isPlaying && (usingQueue || hasCurrentMedia)) startTick();
  else stopTick();
  if (isDragging.value) {
    // eslint-disable-next-line vue/no-side-effects-in-computed-properties
    tempTime.value = curTimeValue.value;
    return curTimeValue.value;
  }

  const queue = store.activePlayerQueue;
  if (queue?.elapsed_time != null && queue?.elapsed_time_last_updated != null) {
    const computed = computeElapsedTime(
      queue.elapsed_time,
      queue.elapsed_time_last_updated,
      queue.state,
    );
    return computed ?? 0;
  }

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

const chapterTicks = computed(() => {
  const ticks: Record<number, string> = {};
  if (store.curQueueItem?.media_item?.metadata?.chapters) {
    store.curQueueItem.media_item.metadata.chapters.forEach((chapter) => {
      ticks[chapter.start] = chapter.name;
    });
  }
  return ticks;
});

// -- Watch ------------------------------------------------------------------
watch(computedElapsedTime, (newTime) => {
  if (!isDragging.value) {
    curTimeValue.value = newTime;
  }
});

// -- Pointer event handlers (drag-to-seek) ----------------------------------
const fractionFromPointer = (e: PointerEvent): number => {
  if (!sliderEl.value) return 0;
  const rect = sliderEl.value.getBoundingClientRect();
  return Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
};

const onPointerDown = (e: PointerEvent) => {
  if (!canSeek.value) return;
  isDragging.value = true;
  isThumbHidden.value = false;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  const fraction = fractionFromPointer(e);
  const time = fraction * duration.value;
  curTimeValue.value = time;
  tempTime.value = time;
};

const onPointerMove = (e: PointerEvent) => {
  if (!isDragging.value) return;
  const fraction = fractionFromPointer(e);
  const time = fraction * duration.value;
  curTimeValue.value = time;
  tempTime.value = time;
};

const onPointerUp = () => {
  if (!isDragging.value) return;
  isDragging.value = false;
  if (store.activePlayer) {
    api.playerCommandSeek(
      store.activePlayer.player_id,
      Math.round(tempTime.value),
    );
  }
};

const onMouseLeave = () => {
  if (!isDragging.value) {
    isThumbHidden.value = true;
  }
};

// -- Helpers ----------------------------------------------------------------
const tickPercent = (pos: number): number => {
  const dur = duration.value;
  return dur > 0 ? (pos / dur) * 100 : 0;
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
/* -- Slider container ------------------------------------------------------ */
.timeline-slider {
  position: relative;
  width: 100%;
  height: 24px;
  display: flex;
  align-items: center;
  cursor: pointer;
  touch-action: pan-y;
  user-select: none;
}
.timeline-slider--disabled {
  pointer-events: none;
  opacity: 0.38;
}

/* -- Track ----------------------------------------------------------------- */
.timeline-track {
  position: relative;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: rgba(var(--v-theme-on-surface), 0.24);
}

/* -- Fill (GPU-only: transform scaleX) ------------------------------------- */
.timeline-fill {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: rgb(var(--v-theme-surface-variant));
  transform-origin: left center;
  transform: scaleX(0);
  will-change: transform;
  backface-visibility: hidden;
}

/* -- Thumb (GPU-only: transform translateX) -------------------------------- */
.timeline-thumb {
  position: absolute;
  left: 0;
  top: 50%;
  width: 10px;
  height: 10px;
  margin-left: -5px;
  border-radius: 50%;
  background-color: rgb(var(--v-theme-surface-variant));
  transform: translateX(0) translateY(-50%);
  will-change: transform;
  backface-visibility: hidden;
  transition: opacity 0.15s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}
.timeline-thumb--hidden {
  opacity: 0;
}

/* -- Chapter ticks --------------------------------------------------------- */
.timeline-tick {
  position: absolute;
  top: 50%;
  width: 4px;
  height: 4px;
  margin-left: -2px;
  margin-top: -2px;
  border-radius: 50%;
  background: rgba(var(--v-theme-on-surface), 0.38);
  cursor: pointer;
}
.timeline-tick-label {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
}

/* -- Time labels ----------------------------------------------------------- */
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
