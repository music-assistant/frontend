<template>
  <div style="width: auto">
    <div v-if="store.activePlayerQueue" style="width: 100%">
      <v-slider
        v-model="curTimeValue"
        :disabled="
          !store.curQueueItem ||
          !store.curQueueItem.media_item ||
          store.curQueueItem.media_item?.media_type != MediaType.TRACK
        "
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
        @start="startDragging"
        @end="stopDragging"
      />

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
import api from '@/plugins/api';
import { MediaType } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import { formatDuration, lightenColor } from '@/helpers/utils';
import { ref, computed, watch } from 'vue';

// properties
export interface Props {
  showLabels?: boolean;
}

withDefaults(defineProps<Props>(), {
  showLabels: false,
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
  if (!store.curQueueItem) return '';
  if (!store.curQueueItem.duration) return '';
  if (store.curQueueItem.media_item?.media_type == MediaType.RADIO) return '';
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
