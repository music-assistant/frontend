<template>
  <div
    class="w-auto"
    :class="usesWaveformLayout ? 'h-8 md:h-10 lg:h-12' : 'h-6'"
  >
    <div v-if="store.activePlayer">
      <SliderRoot
        v-model="wrappedCurTimeValue"
        data-slot="slider"
        class="relative flex items-center select-none touch-none w-full"
        :class="[
          usesWaveformLayout ? 'h-11 md:h-12 lg:h-14' : 'h-8',
          hasWaveform && canSeek ? 'cursor-pointer' : '',
        ]"
        :disabled="!canSeek"
        :min="0"
        :max="store.activePlayer?.current_media?.duration ?? 0"
        :step="0.1"
        @value-commit="stopDragging"
        @pointerenter="isThumbHidden = !canSeek"
        @pointermove="onTrackPointerMove"
        @pointerleave="
          isThumbHidden = true;
          hoverPercent = null;
        "
      >
        <!-- color-mix is the same logic as tailwind's bg-color/30 -->
        <SliderTrack
          data-slot="slider-track"
          class="relative grow rounded-full"
          :class="usesWaveformLayout ? 'h-8 md:h-10 lg:h-12' : 'h-1'"
          :style="
            usesWaveformLayout
              ? undefined
              : {
                  'background-color': `color-mix(in oklab, ${color} 30%, transparent)`,
                }
          "
        >
          <WaveformTrack
            v-if="hasWaveform"
            :data="waveform!"
            :color="color"
            :progress-percent="progressPercent"
            :hover-percent="hoverPercent"
          />
          <div
            v-else-if="waveformLoading"
            class="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full"
            :style="{
              'background-color': `color-mix(in oklab, ${color} 30%, transparent)`,
            }"
          />
          <SliderRange
            v-if="!hasWaveform"
            data-slot="slider-range"
            class="absolute rounded-full h-1 top-1/2 -translate-y-1/2"
            :style="{ 'background-color': color }"
          />
          <!-- pointerdown.stop prevents reka's slider track tap action -->
          <button
            v-for="tick in chapterTicks"
            :key="tick.position"
            type="button"
            class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-4 w-3 items-center justify-center"
            :style="{ left: `${tick.percent}%` }"
            :aria-label="tick.name"
            @pointerdown.stop
            @click.stop="chapterClicked(tick)"
          >
            <span
              class="w-1 h-1 rounded-full bg-background"
              aria-hidden="true"
            ></span>
          </button>
        </SliderTrack>
        <SliderThumb
          data-slot="slider-thumb"
          :style="{ 'background-color': color }"
          :class="
            cn(
              'w-2.5 h-2.5 rounded-full shadow-sm',
              !hasWaveform && (!isThumbHidden || isDragging)
                ? 'block'
                : 'hidden',
            )
          "
        />
        <!-- chapter labels above the track -->
        <template
          v-if="showLabels && !isThumbHidden && chapterTicks.length < 6"
        >
          <button
            v-for="tick in chapterTicks"
            :key="`label-${tick.position}`"
            type="button"
            class="absolute bottom-full mb-1 -translate-x-1/2 appearance-none border-0 bg-transparent p-0 text-caption text-inherit cursor-pointer whitespace-nowrap"
            :style="{ left: `${tick.percent}%` }"
            @pointerdown.stop
            @click="chapterClicked(tick)"
          >
            {{ tick.name }}
          </button>
        </template>
      </SliderRoot>

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
import { MediaType, type MediaItemChapter } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { useActiveAudioSource } from "@/composables/activeAudioSource";
import { useActiveSource } from "@/composables/activeSource";
import { formatDuration } from "@/helpers/utils";
import { ref, computed, watch, toRef, onUnmounted } from "vue";
import computeElapsedTime from "@/helpers/elapsed";
import { computeChapterTicks } from "@/helpers/chapters";
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from "reka-ui";
import { cn } from "@/lib/utils";
import WaveformTrack from "./WaveformTrack.vue";

// properties
export interface Props {
  showLabels?: boolean;
  color?: string;
  // Precomputed waveform bins (0.0-1.0); when set, replaces the flat track.
  waveform?: number[] | null;
  waveformLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showLabels: false,
  color: "var(--foreground)",
  waveform: null,
  waveformLoading: false,
});

const { activeSource } = useActiveSource(toRef(store, "activePlayer"));
const { activeAudioSource } = useActiveAudioSource(
  toRef(store, "activePlayer"),
);

// local refs
const showRemainingTime = ref(false);
const isThumbHidden = ref(true);
const isDragging = ref(false);
const curTimeValue = ref(0);
const tempTime = ref(0);
const pendingSeek = ref<{ position: number; origin: number } | null>(null);
// ticking ref to force recompute of elapsed time (Date.now() is non-reactive)
// rAF drives smooth 60fps slider movement; a 1s interval keeps text
// labels up-to-date when the tab is backgrounded (rAF pauses).
const nowTick = ref(0);
let rafId: number | null = null;
let fallbackTimer: ReturnType<typeof setInterval> | null = null;
let pendingSeekTimer: ReturnType<typeof setTimeout> | null = null;
const SEEK_CONFIRM_TOLERANCE_SECONDS = 1;
const SEEK_CONFIRM_TIMEOUT_MS = 5000;

// reka slider expects number[]
const wrappedCurTimeValue = computed<number[]>({
  get: () => [curTimeValue.value],
  set: (newValue: number[]) => {
    // reka emits update:modelValue on user interaction, drag or track click
    // a setter call means the user is seeking, must be marked as dragging to stop the playback
    // watcher from fighting the thumb, and stash the target for the commit seek
    isDragging.value = true;
    curTimeValue.value = newValue[0];
    tempTime.value = newValue[0];
  },
});

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
  clearPendingSeek();
});

// computed properties
const canSeek = computed(() => {
  if (store.activePlayer?.powered === false) return false;
  const currentMediaDuration = store.activePlayer?.current_media?.duration;
  const currentMediaHasDuration = !!currentMediaDuration;

  // AudioSource queue items carry their own capability flags; defer to them
  // before falling back to the player's source-list source.
  if (activeAudioSource.value) {
    return activeAudioSource.value.can_seek && currentMediaHasDuration;
  }

  // Check if active source allows seeking
  if (activeSource.value) {
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

const serverTiming = computed(() => {
  // Prefer queue-level elapsed_time if available (from isolated reactive map)
  const queue = store.activePlayerQueue;
  const queueId = queue?.queue_id;
  const queueTime = queueId ? api.queueElapsedTime[queueId] : undefined;
  if (
    queueTime?.elapsed_time != null &&
    queueTime?.elapsed_time_last_updated != null
  ) {
    return {
      elapsedTime: queueTime.elapsed_time,
      lastUpdated: queueTime.elapsed_time_last_updated,
      playbackState: queue!.state,
    };
  }

  // Fallback to player-level elapsed_time. This is used for external/3rd-party
  // sources currently playing on the player (not for Music Assistant queue
  // playback). Use the player-level fields when no activePlayerQueue is set.
  // Prefer current_media timing when available (external source playing on the player)
  if (
    store.activePlayer?.current_media?.elapsed_time != null &&
    store.activePlayer?.current_media?.elapsed_time_last_updated != null
  ) {
    return {
      elapsedTime: store.activePlayer.current_media.elapsed_time,
      lastUpdated: store.activePlayer.current_media.elapsed_time_last_updated,
      playbackState: store.activePlayer.playback_state,
    };
  }

  // Fall back to player-level elapsed_time (legacy / provider-level value)
  if (
    store.activePlayer?.elapsed_time != null &&
    store.activePlayer?.elapsed_time_last_updated != null
  ) {
    return {
      elapsedTime: store.activePlayer.elapsed_time,
      lastUpdated: store.activePlayer.elapsed_time_last_updated,
      playbackState: store.activePlayer.playback_state,
    };
  }

  return null;
});

const serverElapsedTime = computed(() => {
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

  const timing = serverTiming.value;
  if (!timing) return 0;

  return (
    computeElapsedTime(
      timing.elapsedTime,
      timing.lastUpdated,
      timing.playbackState,
      store.curQueueItem?.extra_attributes?.playback_speed ?? 1,
    ) ?? 0
  );
});

const displayedElapsedTime = computed(() => {
  if (isDragging.value) {
    // While dragging, mirror the live time into tempTime so the thumb tracks
    // the pointer. Intentional side effect in a computed (oxlint's vue plugin
    // flags it; ESLint has the rule off, so disable it for oxlint only).
    // oxlint-disable-next-line vue/no-side-effects-in-computed-properties
    tempTime.value = curTimeValue.value;
    return curTimeValue.value;
  }

  return pendingSeek.value?.position ?? serverElapsedTime.value;
});

const chapterTicks = computed(() =>
  computeChapterTicks(
    store.curQueueItem?.media_item?.metadata?.chapters,
    store.activePlayer?.current_media?.duration,
  ),
);

const hasWaveform = computed(() => !!props.waveform?.length);
const usesWaveformLayout = computed(
  () => hasWaveform.value || props.waveformLoading,
);

const progressPercent = computed(() => {
  const duration = store.activePlayer?.current_media?.duration;
  if (!duration) return 0;
  return (curTimeValue.value / duration) * 100;
});

// Hover seek-preview position (waveform mode only), as 0-100 percent.
const hoverPercent = ref<number | null>(null);

const onTrackPointerMove = (evt: PointerEvent) => {
  if (!hasWaveform.value || !canSeek.value) return;
  const rect = (evt.currentTarget as HTMLElement).getBoundingClientRect();
  if (!rect.width) return;
  hoverPercent.value = ((evt.clientX - rect.left) / rect.width) * 100;
};

//watch
watch(serverTiming, (timing) => {
  const seek = pendingSeek.value;
  if (!seek || !timing) return;

  const difference = timing.elapsedTime - seek.position;
  const direction = Math.sign(seek.position - seek.origin);
  const reachedTarget =
    Math.abs(difference) <= SEEK_CONFIRM_TOLERANCE_SECONDS ||
    (direction > 0 && difference >= 0) ||
    (direction < 0 && difference <= 0);
  if (reachedTarget) {
    clearPendingSeek();
  }
});

watch(displayedElapsedTime, (newTime) => {
  if (!isDragging.value) {
    curTimeValue.value = newTime;
  }
});

watch(
  () => store.curQueueItem?.queue_item_id,
  () => {
    clearPendingSeek();
    hoverPercent.value = null;
  },
);

// methods
const stopDragging = () => {
  const seekPosition = Math.round(tempTime.value);
  setPendingSeek(seekPosition);
  curTimeValue.value = seekPosition;
  isDragging.value = false;
  if (store.activePlayer) {
    api.playerCommandSeek(store.activePlayer.player_id, seekPosition);
  }
};

const chapterClicked = function (chapter: MediaItemChapter) {
  if (!store.curQueueItem?.media_item) return;
  api.playMedia(
    store.curQueueItem.media_item.uri,
    undefined,
    chapter.position.toString(),
  );
};

const setPendingSeek = (position: number) => {
  clearPendingSeek();
  pendingSeek.value = {
    position,
    origin: serverTiming.value?.elapsedTime ?? position,
  };
  pendingSeekTimer = setTimeout(clearPendingSeek, SEEK_CONFIRM_TIMEOUT_MS);
};

const clearPendingSeek = () => {
  pendingSeek.value = null;
  if (pendingSeekTimer !== null) {
    clearTimeout(pendingSeekTimer);
    pendingSeekTimer = null;
  }
};
</script>

<style scoped>
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
  margin-top: -6px;
  margin-bottom: 5px;
}
.time-text-row > div {
  width: calc(100% / 2);
}
</style>
