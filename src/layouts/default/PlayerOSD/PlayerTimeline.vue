<template>
  <div style="width: auto">
    <div v-if="store.activePlayerQueue" style="width: 100%">
      <v-slider
        v-model="curTimeValue"
        :disabled="
          !store.curQueueItem ||
          !store.curQueueItem.media_item ||
          !store.curQueueItem.duration ||
          store.curQueueItem.media_item.media_type == MediaType.RADIO
        "
        style="width: 100%"
        :min="0"
        :max="store.curQueueItem?.duration"
        hide-details
        :track-size="2"
        :thumb-size="isThumbHidden ? 0 : 10"
        :show-ticks="chapterTicks ? 'always' : false"
        :ticks="chapterTicks"
        tick-size="4"
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
import { formatDuration } from "@/helpers/utils";
import { ref, computed, watch } from "vue";

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
  if (!store.curQueueItem) return "0:00";
  if (showRemainingTime.value) {
    return `-${formatDuration(
      store.curQueueItem.duration - curQueueItemTime.value,
    )}`;
  } else {
    return `${formatDuration(curQueueItemTime.value)}`;
  }
});
const playerTotalTimeStr = computed(() => {
  if (!store.curQueueItem) return "";
  if (!store.curQueueItem.duration) return "";
  if (store.curQueueItem.media_item?.media_type == MediaType.RADIO) return "";
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
