<template>
  <div style="width: auto; height: 24px">
    <div v-if="store.activePlayerQueue" style="width: 100%">
      <v-slider
        v-model="curTimeValue"
        :disabled="
          !store.curQueueItem ||
          !store.curQueueItem.media_item ||
          !store.curQueueItem.duration ||
          store.curQueueItem.media_item.media_type == MediaType.RADIO ||
          store.activePlayer?.powered == false
        "
        style="width: 100%"
        :min="0"
        :max="playerCurQueueItemDuration"
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
import { formatDuration } from "@/helpers/utils";
import { ref, computed, watch } from "vue";

// properties
export interface Props {
  showLabels?: boolean;
  color?: string;
}

withDefaults(defineProps<Props>(), {
  showLabels: false,
  color: undefined,
});

// local refs
const showRemainingTime = ref(false);
const isThumbHidden = ref(true);
const isDragging = ref(false);
const curTimeValue = ref(0);
const tempTime = ref(0);

const chapterTime = computed(() =>
  localStorage.getItem("frontend.settings.audiobook_chapter_time") == "true"
);

// computed properties
const curChapter = computed(() => {
  if (store.curQueueItem?.media_item?.metadata?.chapters) {
    return store.curQueueItem.media_item.metadata.chapters.find((chapter) => {
      if (!store.activePlayerQueue?.elapsed_time) return null;
      if (!chapter.end) return null;
      return (
        chapter.start < store.activePlayerQueue?.elapsed_time &&
        chapter.end > store.activePlayerQueue?.elapsed_time
      );
    });
  }
  return null;
});

const playerCurQueueItemDuration = computed(() => {
  if (
    chapterTime.value &&
    store.curQueueItem?.media_item?.media_type == MediaType.AUDIOBOOK
  ) {
    if (!curChapter.value?.end) return 0;
    return curChapter.value?.end - curChapter.value?.start;
  }
  return store.curQueueItem?.duration;
});

const curQueueItemTime = computed(() => {
  if (isDragging.value) {
    // eslint-disable-next-line vue/no-side-effects-in-computed-properties
    tempTime.value = curTimeValue.value;
    return curTimeValue.value;
  }

  if (store.activePlayerQueue) {
    if (
      chapterTime.value &&
      store.curQueueItem?.media_item?.media_type == MediaType.AUDIOBOOK
    ) {
      if (!curChapter.value?.start) return 0;
      return store.activePlayerQueue?.elapsed_time - curChapter.value?.start;
    }
    return store.activePlayerQueue.elapsed_time;
  }
  return 0;
});

const playerCurTimeStr = computed(() => {
  if (!playerCurQueueItemDuration.value || !curQueueItemTime.value) return "0:00";
  if (showRemainingTime.value) {
    return `-${formatDuration(
      playerCurQueueItemDuration.value - curQueueItemTime.value,
    )}`;
  } else {
    return `${formatDuration(curQueueItemTime.value)}`;
  }
});

const playerTotalTimeStr = computed(() => {
  if (!playerCurQueueItemDuration.value || !store.curQueueItem) return "";
  if (store.curQueueItem.media_item?.media_type == MediaType.RADIO) return "";
  const totalSecs = playerCurQueueItemDuration.value;
  return formatDuration(totalSecs);
});

const chapterTicks = computed(() => {
  const ticks: Record<number, string> = {};
  if (chapterTime.value) return [];
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
    var seekTime = tempTime.value;
    if (curChapter.value?.start && chapterTime.value) seekTime = curChapter.value?.start + seekTime;
    api.playerCommandSeek(store.activePlayer.player_id, Math.round(seekTime));
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
