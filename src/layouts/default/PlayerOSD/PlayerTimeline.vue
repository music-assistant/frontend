<template>
  <div style="width: 100%">
    <div
      v-if="store.activePlayerQueue && !isProgressBar"
      style="display: flex; flex: 1 1 auto; align-items: center"
    >
      <!-- current time detail -->
      <div
        class="text-caption"
        style="cursor: pointer; z-index: 1"
        @click="
          showRemainingTime
            ? (showRemainingTime = false)
            : (showRemainingTime = true)
        "
      >
        {{ playerCurTimeStr }}
      </div>

      <v-slider
        v-model="curTimeValue"
        :disabled="
          !store.curQueueItem ||
          store.curQueueItem.media_item?.media_type != MediaType.TRACK
        "
        :color="props.color"
        style="width: 100%"
        :min="0"
        :max="store.curQueueItem && store.curQueueItem.duration"
        hide-details
        :track-size="2"
        :thumb-size="isThumbHidden ? 0 : 10"
        @touchstart="isThumbHidden = false"
        @touchend="isThumbHidden = true"
        @mouseenter="isThumbHidden = false"
        @mouseleave="isThumbHidden = true"
        @mousedown="startDragging"
        @mouseup="stopDragging"
      />

      <!-- end time detail -->
      <div style="z-index: 1" class="text-caption">
        {{ playerTotalTimeStr }}
      </div>
    </div>
    <div
      v-else-if="store.activePlayerQueue && isProgressBar"
      style="width: 100%; padding-bottom: 0px"
    >
      <v-progress-linear
        v-model="curTimeValue"
        :disabled="
          !store.activePlayerQueue ||
          !store.curQueueItem ||
          store.activePlayerQueue?.items == 0
        "
        height="70"
        :color="lightenColor(props.color, 0.15)"
        :bg-color="props.color"
        :bg-opacity="1"
        style="position: absolute; border-radius: 10px"
        :min="0"
        :max="store.curQueueItem && store.curQueueItem.duration"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import api from '@/plugins/api';
import { MediaType } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import { formatDuration, lightenColor } from '@/helpers/utils';
import { ref, computed, watch } from 'vue';

// properties
export interface Props {
  isProgressBar?: boolean;
  color?: string;
}

const props = withDefaults(defineProps<Props>(), {
  isProgressBar: false,
  color: 'accent',
});

// local refs
const showRemainingTime = ref(false);
const isThumbHidden = ref(true);
const isDragging = ref(false);
const curTimeValue = ref(0);
const tempTime = ref(0);

// computed properties
const playerCurTimeStr = computed(() => {
  if (!store.curQueueItem) return '0:00';
  if (showRemainingTime.value) {
    return `-${formatDuration(
      store.curQueueItem.duration - curQueueItemTime.value,
    )}`;
  } else {
    return `${formatDuration(curQueueItemTime.value)}`;
  }
});
const playerTotalTimeStr = computed(() => {
  if (!store.curQueueItem) return '0:00';
  const totalSecs = store.curQueueItem.duration;
  return formatDuration(totalSecs);
});
const curQueueItemTime = computed(() => {
  if (isDragging.value) {
    // eslint-disable-next-line vue/no-side-effects-in-computed-properties
    tempTime.value = curTimeValue.value;
    return curTimeValue.value;
  }
  if (store.activePlayerQueue) return store.activePlayerQueue.elapsed_time;
  return 0;
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
  updateTime(tempTime.value);
};

const updateTime = (newTime: number) => {
  if (!isDragging.value) {
    api.queueCommandSeek(
      store.activePlayerQueue?.queue_id || '',
      Math.round(newTime),
    );
  }
};
</script>
