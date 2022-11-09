<template>
  <v-slider
    v-if="
      props.activePlayerQueue?.active &&
      curQueueItem &&
      curQueueItem.media_item?.media_type == MediaType.TRACK &&
      !props.isMobile
    "
    style="width: 100%"
    :model-value="curQueueItemTime"
    :min="0"
    :max="curQueueItem.duration"
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
        v-if="curQueueItem.media_item?.media_type !== MediaType.RADIO"
        class="text-caption"
        style="cursor: pointer"
        @click="
          showRemainingTime
            ? (showRemainingTime = false)
            : (showRemainingTime = true)
        "
      >
        {{ playerCurTimeStr || '00:00' }}
      </div>
    </template>

    <template #append>
      <!-- end time detail -->
      <div
        v-if="curQueueItem.media_item?.media_type !== MediaType.RADIO"
        class="text-caption"
      >
        {{ playerTotalTimeStr || '00:00' }}
      </div>
    </template>
  </v-slider>
  <div
    v-else-if="
      props.activePlayerQueue?.active &&
      curQueueItem &&
      curQueueItem.media_item?.media_type == MediaType.TRACK &&
      $vuetify.display.width < getResponsiveBreakpoints.breakpoint_1 &&
      props.isMobile
    "
    style="width: 100%; padding-bottom: 5px"
  >
    <v-progress-linear
      color="accent"
      :model-value="curQueueItemTime"
      :height="2"
      :min="0"
      :max="curQueueItem.duration"
    ></v-progress-linear>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { api, MediaType, type PlayerQueue } from '../../plugins/api';
import { formatDuration, getResponsiveBreakpoints } from '../../utils';

// properties
export interface Props {
  activePlayerQueue?: PlayerQueue;
  isMobile?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isMobile: false,
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
  if (!curQueueItem.value) return '0:00';
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
  if (!curQueueItem.value) return '0:00';
  const totalSecs = curQueueItem.value.duration;
  return formatDuration(totalSecs);
});
const curQueueItemTime = computed(() => {
  if (props.activePlayerQueue) return props.activePlayerQueue.elapsed_time;
  return 0;
});
</script>
