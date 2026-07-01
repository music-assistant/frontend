<template>
  <div class="w-auto h-6">
    <div v-if="store.activePlayer">
      <SliderRoot
        v-model="wrappedCurTimeValue"
        data-slot="slider"
        class="relative flex items-center select-none touch-none w-full h-8"
        :disabled="!canSeek"
        :min="0"
        :max="store.activePlayer?.current_media?.duration ?? 0"
        :step="0.1"
        @value-commit="stopDragging"
        @pointerenter="isThumbHidden = !canSeek"
        @pointerleave="isThumbHidden = true"
      >
        <!-- color-mix is the same logic as tailwind's bg-color/30 -->
        <SliderTrack
          data-slot="slider-track"
          class="relative grow rounded-full h-1"
          :style="{
            'background-color': `color-mix(in oklab, ${color} 30%, transparent)`,
          }"
        >
          <SliderRange
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
              !isThumbHidden || isDragging ? 'block' : 'hidden',
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

// properties
export interface Props {
  showLabels?: boolean;
  color?: string;
}

withDefaults(defineProps<Props>(), {
  showLabels: false,
  color: "var(--foreground)",
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
// ticking ref to force recompute of elapsed time (Date.now() is non-reactive)
// rAF drives smooth 60fps slider movement; a 1s interval keeps text
// labels up-to-date when the tab is backgrounded (rAF pauses).
const nowTick = ref(0);
let rafId: number | null = null;
let fallbackTimer: ReturnType<typeof setInterval> | null = null;

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
    // While dragging, mirror the live time into tempTime so the thumb tracks
    // the pointer. Intentional side effect in a computed (oxlint's vue plugin
    // flags it; ESLint has the rule off, so disable it for oxlint only).
    // oxlint-disable-next-line vue/no-side-effects-in-computed-properties
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
      store.curQueueItem?.extra_attributes?.playback_speed ?? 1,
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
      store.curQueueItem?.extra_attributes?.playback_speed ?? 1,
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
      store.curQueueItem?.extra_attributes?.playback_speed ?? 1,
    );
    return computed ?? 0;
  }

  return 0;
});

const chapterTicks = computed(() =>
  computeChapterTicks(
    store.curQueueItem?.media_item?.metadata?.chapters,
    store.activePlayer?.current_media?.duration,
  ),
);

//watch
watch(computedElapsedTime, (newTime) => {
  if (!isDragging.value) {
    curTimeValue.value = newTime;
  }
});

// methods
const stopDragging = () => {
  isDragging.value = false;
  if (store.activePlayer) {
    api.playerCommandSeek(
      store.activePlayer.player_id,
      Math.round(tempTime.value),
    );
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
  margin-top: -10px;
  margin-bottom: 5px;
}
.time-text-row > div {
  width: calc(100% / 2);
}
</style>
