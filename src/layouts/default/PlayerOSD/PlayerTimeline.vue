<template>
  <div
    v-if="!props.isHidden"
    style="width: 100%"
  >
    <div v-if="activePlayerQueue && !isProgressBar">
      <v-slider
        :disabled="!curQueueItem || curQueueItem.media_item?.media_type != MediaType.TRACK"
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
            activePlayerQueue?.queue_id || '',
            Math.round($event)
          )
        "
      >
        <template #prepend>
          <!-- current time detail -->
          <div
            class="text-caption"
            style="cursor: pointer; z-index: 1;"
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
          <div
            style="z-index: 1;"
            class="text-caption"
          >
            {{ playerTotalTimeStr }}
          </div>
        </template>
      </v-slider>
    </div>
    <div
      v-else-if="activePlayerQueue && isProgressBar"
      style="width: 100%; padding-bottom: 5px"
    >
      <v-progress-linear
        :disabled="
          !activePlayerQueue ||
            !curQueueItem ||
            activePlayerQueue?.items == 0
        "
        color="accent"
        :model-value="curQueueItemTime"
        :height="2"
        :min="0"
        :max="curQueueItem && curQueueItem.duration"
      />
    </div>
  </div>
</template>
  
<script setup lang="ts">
import api from '@/plugins/api';
import { MediaType } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import { formatDuration } from '@/utils';
import { ref, computed } from 'vue';

// properties
export interface Props {
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
const activePlayerQueue = computed(() => {
    if (store.selectedPlayer) {
      return api.queues[store.selectedPlayer.active_source];
    }
    return undefined;
  });
const curQueueItem = computed(() => {
  if (activePlayerQueue.value) return activePlayerQueue.value.current_item;
  return undefined;
});
const playerCurTimeStr = computed(() => {
  if (!curQueueItem.value) return "0:00";
  if (showRemainingTime.value) {
    return `-${formatDuration(
      curQueueItem.value.duration - curQueueItemTime.value
    )}`;
  } else {
    return `${formatDuration(curQueueItemTime.value)}`;
  }
});
const playerTotalTimeStr = computed(() => {
  if (!curQueueItem.value) return "0:00";
  const totalSecs = curQueueItem.value.duration;
  return formatDuration(totalSecs);
});
const curQueueItemTime = computed(() => {
  if (activePlayerQueue.value) return activePlayerQueue.value.elapsed_time;
  return 0;
});
</script>
  