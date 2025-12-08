<template>
  <div style="width: auto; height: 24px">
    <div v-if="store.activePlayer" style="width: 100%">
      <v-slider
        v-model="curTimeValue"
        :disabled="!canSeek"
        style="width: 100%"
        :min="0"
        :max="
          store.curQueueItem?.duration ||
          store.activePlayer?.current_media?.duration
        "
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
import { useActiveSource } from "@/composables/activeSource";
import { formatDuration } from "@/helpers/utils";
import { ref, computed, watch, toRef, onMounted, onUnmounted } from "vue";
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

// local refs
const showRemainingTime = ref(false);
const isThumbHidden = ref(true);
const isDragging = ref(false);
const curTimeValue = ref(0);
const tempTime = ref(0);
// ticking ref to force recompute of elapsed time (Date.now() is non-reactive)
const nowTick = ref(0);
let tickTimer: ReturnType<typeof setInterval> | null = null;

const startTick = (interval = 500) => {
  if (!tickTimer)
    tickTimer = setInterval(() => (nowTick.value = Date.now()), interval);
};

const stopTick = () => {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
};

onUnmounted(() => {
  stopTick();
});

// computed properties
const canSeek = computed(() => {
  // Check if active source allows seeking
  if (activeSource.value) {
    // When an active external source is present, only allow seeking if the
    // source reports that it supports seeking (can_seek) AND the current
    // media (or queue item) has a known duration. We also keep checks for
    // powered state and radio streams.
    if (store.activePlayer?.powered === false) return false;

    // If queue is active prefer queue duration
    const queueHasDuration = !!store.curQueueItem?.duration;
    const currentMediaDuration = store.activePlayer?.current_media?.duration;
    const currentMediaHasDuration = !!currentMediaDuration;

    // Disallow seeking for radio streams
    const isRadio =
      store.curQueueItem?.media_item?.media_type == MediaType.RADIO ||
      store.activePlayer?.current_media?.media_type == MediaType.RADIO;
    if (isRadio) return false;

    // If the active source reports can_seek, allow seeking when there is a
    // duration available (either queue item or current_media).
    if (
      activeSource.value.can_seek &&
      (queueHasDuration || currentMediaHasDuration)
    )
      return true;

    return false;
  }

  if (store.curQueueItem?.media_item?.media_type == MediaType.RADIO)
    return false;
  if (store.activePlayer?.powered == false) return false;
  if (!store.curQueueItem) return false;
  if (!store.curQueueItem.media_item) return false;
  // Duration must be present and truthy (non-zero) for seeking when using the
  // local queue. Elapsed_time may be 0, but duration of 0 isn't seekable.
  if (!store.curQueueItem.duration) return false;

  // Default to true if no active source (queue control)
  return true;
});

const playerCurTimeStr = computed(() => {
  // If there's an active queue item use its duration arithmetic
  if (store.curQueueItem) {
    if (showRemainingTime.value) {
      return `-${formatDuration(
        store.curQueueItem.duration - curQueueItemTime.value,
      )}`;
    }
    return `${formatDuration(curQueueItemTime.value)}`;
  }

  // No queue item: prefer current_media elapsed when available
  if (
    store.activePlayer?.current_media?.elapsed_time != null ||
    store.activePlayer?.elapsed_time != null
  ) {
    const val = curQueueItemTime.value || 0;
    if (showRemainingTime.value && store.activePlayer?.current_media?.duration)
      return `-${formatDuration(
        store.activePlayer.current_media.duration - val,
      )}`;
    return `${formatDuration(val)}`;
  }

  return "0:00";
});

const playerTotalTimeStr = computed(() => {
  // Prefer queue item duration, fall back to current_media duration for external sources
  const duration =
    store.curQueueItem?.duration || store.activePlayer?.current_media?.duration;
  if (!duration) return "";
  // If radio/streaming with unknown duration, don't show
  const isRadio =
    store.curQueueItem?.media_item?.media_type == MediaType.RADIO ||
    store.activePlayer?.current_media?.media_type == MediaType.RADIO;
  if (isRadio) return "";
  return formatDuration(duration);
});

const curQueueItemTime = computed(() => {
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
      store.activePlayer?.playback_state,
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

//watch
watch(curQueueItemTime, (newTime) => {
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
