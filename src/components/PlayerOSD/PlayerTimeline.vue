<template>
  <div v-if="!props.isHidden" style="width: 100%">
    <div v-if="props.activePlayerQueue && !isProgressBar">
      <v-slider
        :disabled="
          !props.activePlayerQueue ||
          !curQueueItem ||
          props.activePlayerQueue?.items == 0
        "
        color="accent"
        style="width: 100%"
        :model-value="curQueueItemTime"
        :min="0"
        :max="curQueueItem && curQueueItem.duration"
        hide-details
        :track-size="2"
        :thumb-size="isThumbHidden ? 0 : 10"
        @touchstart="isThumbHidden = false"
        @touchend="isThumbHidden = true"
        @mouseenter="isThumbHidden = false"
        @mouseleave="isThumbHidden = true"
        @update:model-value="
          api.queueCommandSeek(
            props.activePlayerQueue?.queue_id || '',
            Math.round($event)
          )
        "
      >
        <template #prepend>
          <!-- current time detail -->
          <div
            class="text-caption"
            style="cursor: pointer"
            @click="
              showRemainingTime
                ? (showRemainingTime = false)
                : (showRemainingTime = true)
            "
          >
            {{ playerCurTimeStr }}
          </div>
        </template>

        <template #append>
          <!-- end time detail -->
          <div class="text-caption">
            {{ playerTotalTimeStr }}
          </div>
        </template>
      </v-slider>
    </div>
    <div
      v-else-if="props.activePlayerQueue && isProgressBar"
      style="width: 100%; padding-bottom: 5px"
    >
      <v-progress-linear
        :disabled="
          !props.activePlayerQueue ||
          !curQueueItem ||
          props.activePlayerQueue?.items == 0
        "
        color="accent"
        :model-value="curQueueItemTime"
        :height="2"
        :min="0"
        :max="curQueueItem && curQueueItem.duration"
      >
      </v-progress-linear>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { api, MediaType, type PlayerQueue } from '../../plugins/api';
import {
  formatDuration,
  getResponsiveBreakpoints,
  isMobile,
} from '../../utils';

// properties
export interface Props {
  activePlayerQueue?: PlayerQueue;
  isProgressBar?: boolean;
  isHidden?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isProgressBar: false,
  isHidden: false,
});

// local refs
const showRemainingTime = ref(false);
const isThumbHidden = ref(true);

// computed properties
const curQueueItem = computed(() => {
  if (props.activePlayerQueue?.active)
    return props.activePlayerQueue.current_item;
  return undefined;
});
const playerCurTimeStr = computed(() => {
  if (!curQueueItem.value || curQueueItem.value == null) return '0:00';
  if (curQueueItem.value.media_item?.media_type === MediaType.RADIO) return '∞';
  if (showRemainingTime.value) {
    return `-${formatDuration(
      curQueueItem.value.duration - curQueueItemTime.value
    )}`;
  } else {
    return `${formatDuration(curQueueItemTime.value)}`;
  }
});
const streamDetails = computed(() => {
  return props.activePlayerQueue?.current_item?.streamdetails;
});
const playerTotalTimeStr = computed(() => {
  if (!curQueueItem.value && curQueueItem.value == null) return '0:00';
  if (curQueueItem.value.media_item?.media_type === MediaType.RADIO) return '∞';
  const totalSecs = curQueueItem.value.duration;
  return formatDuration(totalSecs);
});
const curQueueItemTime = computed(() => {
  if (props.activePlayerQueue) return props.activePlayerQueue.elapsed_time;
  return 0;
});
</script>
