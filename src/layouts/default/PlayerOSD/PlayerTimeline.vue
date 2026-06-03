<template>
  <div style="width: auto; height: 24px">
    <div v-if="store.activePlayer" style="width: 100%">
      <v-slider
        v-model="curTimeValue"
        :disabled="!canSeek"
        style="width: 100%"
        :min="0"
        :max="store.activePlayer?.current_media?.duration"
        hide-details
        :track-size="4"
        :thumb-size="isThumbHidden ? 0 : 10"
        :show-ticks="chapterTicks ? 'always' : false"
        :ticks="chapterTicks"
        tick-size="4"
        :color="color"
        @touchstart="isThumbHidden = false"
        @touchend="isThumbHidden = true"
        @mouseenter="isThumbHidden = false"
        @mouseleave="isThumbHidden = true"
        @start="startDragging"
        @end="stopDragging"
      >
        <template #tick-label="{ tick }">
          <a
            v-if="
              showLabels &&
              !isThumbHidden &&
              Object.values(chapterTicks).length < 6
            "
            class="text-caption"
            @click="chapterClicked(tick.value)"
            >{{ tick.label }}</a
          >
        </template>
      </v-slider>

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
import { useActiveAudioSource } from "@/composables/activeAudioSource";
import { useActiveSource } from "@/composables/activeSource";
import { formatDuration } from "@/helpers/utils";
import { ref, computed, watch, toRef, onUnmounted } from "vue";
import computeElapsedTime from "@/helpers/elapsed";

// properties
export interface Props {
  showLabels?: boolean;
  color?: string;
}

withDefaults(defineProps<Props>(), {
  showLabels: false,
  color: undefined,
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
// After a seek, hold the slider at the target until the backend's elapsed time
// catches up, so it doesn't briefly snap back to the pre-seek position.
const pendingSeek = ref<number | null>(null);
let pendingSeekTimer: ReturnType<typeof setTimeout> | null = null;
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
  if (pendingSeekTimer) clearTimeout(pendingSeekTimer);
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

// Whether the elapsed-time ticker should run: only while a source is actively
// playing and its position advances with wall-clock time (a live MA queue, or an
// external source reporting current_media). Gating the rAF/interval loop from a
// dedicated watch — rather than from inside computedElapsedTime — keeps that
// getter pure: a computed must not start/stop timers as a side effect (it can be
// re-evaluated any number of times, and Vue gives no ordering guarantees).
const shouldTick = computed(() => {
  const isPlaying = store.activePlayer?.playback_state === "playing";
  const usingQueue = !!(
    store.activePlayerQueue && store.activePlayerQueue.active
  );
  const hasCurrentMedia =
    store.activePlayer?.current_media?.elapsed_time != null;
  return isPlaying && (usingQueue || hasCurrentMedia);
});

watch(
  shouldTick,
  (active) => {
    if (active) startTick();
    else stopTick();
  },
  { immediate: true },
);

const computedElapsedTime = computed(() => {
  // Read nowTick so this getter re-evaluates on each ticker frame, refreshing the
  // wall-clock extrapolation below. The ticker is started/stopped by the
  // shouldTick watch above — never here — so this computed stays side-effect-free.
  void nowTick.value;

  if (isDragging.value) {
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
  if (isDragging.value) return;
  if (pendingSeek.value !== null) {
    // Ignore stale pre-seek values; release once the backend confirms (±2s).
    if (Math.abs(newTime - pendingSeek.value) > 2) return;
    pendingSeek.value = null;
    if (pendingSeekTimer) {
      clearTimeout(pendingSeekTimer);
      pendingSeekTimer = null;
    }
  }
  curTimeValue.value = newTime;
});

// methods
const startDragging = function () {
  isDragging.value = true;
};

const stopDragging = (value: number) => {
  isDragging.value = false;
  if (!store.activePlayer) return;
  const target = Math.round(value);
  // Optimistic: show the target immediately and hold it until the backend
  // reports a matching elapsed time (or the safety timeout fires).
  curTimeValue.value = target;
  pendingSeek.value = target;
  if (pendingSeekTimer) clearTimeout(pendingSeekTimer);
  pendingSeekTimer = setTimeout(() => {
    pendingSeek.value = null;
    pendingSeekTimer = null;
  }, 3000);
  api.playerCommandSeek(store.activePlayer.player_id, target);
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
.v-slider.v-input--horizontal {
  align-items: center;
  margin-inline: 0px;
}
</style>
