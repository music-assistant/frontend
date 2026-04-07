<template>
  <div style="width: auto; height: 24px">
    <div
      v-if="store.activePlayer"
      class="timeline-container"
      :style="color ? { '--timeline-color': color } : undefined"
    >
      <div
        ref="trackRef"
        class="timeline-track"
        :class="{ 'timeline-track--disabled': !canSeek }"
        role="slider"
        :aria-valuenow="Math.round(curTimeValue)"
        :aria-valuemin="0"
        :aria-valuemax="Math.round(duration)"
        :aria-disabled="!canSeek"
        tabindex="0"
        @mouseenter="isThumbHidden = false"
        @mouseleave="isThumbHidden = true"
        @touchstart.passive="onPointerDown"
        @mousedown="onPointerDown"
        @keydown="onKeyDown"
      >
        <!-- background track -->
        <div class="timeline-rail"></div>
        <!-- filled portion: GPU-composited via scaleX -->
        <div
          class="timeline-fill"
          :style="{ transform: `scaleX(${progress})` }"
        ></div>
        <!-- chapter ticks -->
        <template v-if="chapterTicks && Object.keys(chapterTicks).length">
          <div
            v-for="(label, pos) in chapterTicks"
            :key="pos"
            class="timeline-tick"
            :style="{ left: `${(Number(pos) / duration) * 100}%` }"
            @click.stop="chapterClicked(Number(pos))"
          >
            <span
              v-if="
                showLabels &&
                !isThumbHidden &&
                Object.values(chapterTicks).length < 6
              "
              class="timeline-tick-label text-caption"
            >
              {{ label }}
            </span>
          </div>
        </template>
        <!-- thumb -->
        <div
          class="timeline-thumb"
          :class="{ 'timeline-thumb--hidden': isThumbHidden }"
          :style="{ left: `${progress * 100}%` }"
        ></div>
      </div>

      <div v-if="showLabels" class="time-text-row">
        <!-- current time detail -->
        <div
          class="text-caption time-text-left"
          @click="showRemainingTime = !showRemainingTime"
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

// local refs
const trackRef = ref<HTMLElement | null>(null);
const showRemainingTime = ref(false);
const isThumbHidden = ref(true);
const isDragging = ref(false);
const curTimeValue = ref(0);
const tempTime = ref(0);
const pendingSeekTarget = ref<number | null>(null);
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

  // Prefer queue-level elapsed_time if available (from isolated reactive map)
  const queue = store.activePlayerQueue;
  const queueId = queue?.queue_id;
  const queueTime = queueId ? api.queueElapsedTime[queueId] : undefined;
  if (
    queueTime?.elapsed_time != null &&
    queueTime?.elapsed_time_last_updated != null
  ) {
    const computed = computeElapsedTime(
      queueTime.elapsed_time,
      queueTime.elapsed_time_last_updated,
      queue!.state,
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

const chapterTicks = computed(() => {
  const ticks: Record<number, string> = {};
  if (store.curQueueItem?.media_item?.metadata?.chapters) {
    store.curQueueItem.media_item.metadata.chapters.forEach((chapter) => {
      ticks[chapter.start] = chapter.name;
    });
  }
  return ticks;
});

const duration = computed(
  () => store.activePlayer?.current_media?.duration || 1,
);

const progress = computed(() => {
  return Math.min(Math.max(curTimeValue.value / duration.value, 0), 1);
});

//watch
watch(computedElapsedTime, (newTime) => {
  if (isDragging.value) return;
  if (pendingSeekTarget.value != null) {
    if (Math.abs(newTime - pendingSeekTarget.value) < 2) {
      pendingSeekTarget.value = null;
    } else {
      return;
    }
  }
  curTimeValue.value = newTime;
});

// methods
const seekToPosition = (clientX: number) => {
  if (!trackRef.value || !canSeek.value) return;
  const rect = trackRef.value.getBoundingClientRect();
  const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  curTimeValue.value = ratio * duration.value;
  tempTime.value = curTimeValue.value;
};

const onPointerDown = (e: MouseEvent | TouchEvent) => {
  if (!canSeek.value) return;
  isDragging.value = true;
  isThumbHidden.value = false;

  const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
  seekToPosition(clientX);

  const onMove = (ev: MouseEvent | TouchEvent) => {
    const x = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
    seekToPosition(x);
  };

  const onUp = () => {
    isDragging.value = false;
    isThumbHidden.value = true;
    if (store.activePlayer) {
      pendingSeekTarget.value = tempTime.value;
      api.playerCommandSeek(
        store.activePlayer.player_id,
        Math.round(tempTime.value),
      );
    }
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onUp);
  };

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
  document.addEventListener("touchmove", onMove, { passive: true });
  document.addEventListener("touchend", onUp);
};

let keySeekTimer: ReturnType<typeof setTimeout> | null = null;

const onKeyDown = (e: KeyboardEvent) => {
  if (!canSeek.value || !store.activePlayer) return;
  const range = duration.value;
  let newTime = curTimeValue.value;
  if (e.key === "ArrowRight")
    newTime += e.shiftKey ? range * 0.1 : range * 0.01;
  else if (e.key === "ArrowLeft")
    newTime -= e.shiftKey ? range * 0.1 : range * 0.01;
  else if (e.key === "PageUp") newTime += range * 0.1;
  else if (e.key === "PageDown") newTime -= range * 0.1;
  else if (e.key === "Home") newTime = 0;
  else if (e.key === "End") newTime = range;
  else return;
  e.preventDefault();
  isDragging.value = true;
  newTime = Math.min(Math.max(newTime, 0), range);
  curTimeValue.value = newTime;
  tempTime.value = newTime;
  if (keySeekTimer) clearTimeout(keySeekTimer);
  const playerId = store.activePlayer.player_id;
  keySeekTimer = setTimeout(() => {
    isDragging.value = false;
    pendingSeekTarget.value = tempTime.value;
    api.playerCommandSeek(playerId, Math.round(tempTime.value));
  }, 300);
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
.timeline-container {
  width: 100%;
  --timeline-color: rgb(var(--v-theme-primary));
}

.timeline-track {
  position: relative;
  height: 24px;
  display: flex;
  align-items: center;
  cursor: pointer;
  touch-action: none;
  user-select: none;
}

.timeline-track--disabled {
  cursor: default;
  opacity: 0.5;
}

.timeline-rail {
  position: absolute;
  left: 0;
  right: 0;
  height: 4px;
  border-radius: 2px;
  background: rgba(var(--v-theme-on-surface), 0.2);
}

.timeline-fill {
  position: absolute;
  left: 0;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  transform-origin: left center;
  will-change: transform;
  background-color: var(--timeline-color);
}

.timeline-thumb {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-left: -5px;
  background-color: var(--timeline-color);
  transition: opacity 0.15s ease;
}

.timeline-thumb--hidden {
  opacity: 0;
}

.timeline-tick {
  position: absolute;
  top: 50%;
  width: 2px;
  height: 4px;
  margin-top: -2px;
  margin-left: -1px;
  background: rgba(var(--v-theme-on-surface), 0.5);
  cursor: pointer;
}

.timeline-tick-label {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
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
