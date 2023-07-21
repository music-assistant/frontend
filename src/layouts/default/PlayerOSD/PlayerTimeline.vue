<template>
  <div style="width: 100%">
    <div v-if="activePlayerQueue && !isProgressBar" style="display: flex; flex: 1 1 auto; align-items: center">
      <!-- current time detail -->
      <div
        class="text-caption"
        style="cursor: pointer; z-index: 1"
        @click="showRemainingTime ? (showRemainingTime = false) : (showRemainingTime = true)"
      >
        {{ playerCurTimeStr }}
      </div>

      <v-slider
        v-model="curTimeValue"
        :disabled="!curQueueItem || curQueueItem.media_item?.media_type != MediaType.TRACK"
        :color="props.color"
        style="width: 100%"
        :min="0"
        :max="curQueueItem && curQueueItem.duration"
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
    <div v-else-if="activePlayerQueue && isProgressBar" style="width: 100%; padding-bottom: 0px">
      <v-progress-linear
        v-model="curTimeValue"
        :disabled="!activePlayerQueue || !curQueueItem || activePlayerQueue?.items == 0"
        height="70"
        :color="lightenColor(props.color, 0.1)"
        :bg-color="props.color"
        :bg-opacity="1"
        style="position: absolute; border-radius: 10px"
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
import { formatDuration, lightenColor } from '@/utils';
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
  if (!curQueueItem.value) return '0:00';
  if (showRemainingTime.value) {
    return `-${formatDuration(curQueueItem.value.duration - curQueueItemTime.value)}`;
  } else {
    return `${formatDuration(curQueueItemTime.value)}`;
  }
});
const playerTotalTimeStr = computed(() => {
  if (!curQueueItem.value) return '0:00';
  const totalSecs = curQueueItem.value.duration;
  return formatDuration(totalSecs);
});
const curQueueItemTime = computed(() => {
  if (isDragging.value) {
    // eslint-disable-next-line vue/no-side-effects-in-computed-properties
    tempTime.value = curTimeValue.value;
    return curTimeValue.value;
  }
  if (activePlayerQueue.value) return activePlayerQueue.value.elapsed_time;
  return 0;
});

//watch
watch(curQueueItemTime, (newTime) => {
  if (!isDragging.value) {
    curTimeValue.value = newTime;
  }
});

// methodes
const startDragging = function () {
  isDragging.value = true;
};

const stopDragging = () => {
  isDragging.value = false;
  updateTime(tempTime.value);
};

const updateTime = (newTime: number) => {
  if (!isDragging.value) {
    api.queueCommandSeek(activePlayerQueue.value?.queue_id || '', Math.round(newTime));
  }
};
</script>
