<template>
  <div style="width: auto; height: 24px">
    <div
      v-if="store.activePlayer"
      class="timeline-container"
      :style="color ? { '--timeline-color': color } : undefined"
    >
      <ProgressBar
        v-model="curTimeValue"
        :min="0"
        :max="duration"
        :disabled="!canSeek"
        :ticks="chapterTicks"
        :show-tick-labels="showLabels"
        :color="color"
        @seek-start="onSeekStart"
        @seek-end="onSeekEnd"
        @tick-click="chapterClicked"
      />

      <div v-if="showLabels" class="time-text-row">
        <div
          class="text-caption time-text-left"
          @click="showRemainingTime = !showRemainingTime"
        >
          {{ playerCurTimeStr }}
        </div>
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
import { ref, computed, watch, toRef, onUnmounted } from "vue";
import computeElapsedTime from "@/helpers/elapsed";
import ProgressBar from "@/components/ui/progress-bar/ProgressBar.vue";

export interface Props {
  showLabels?: boolean;
  color?: string;
}

const props = withDefaults(defineProps<Props>(), {
  showLabels: false,
  color: undefined,
});

const { activeSource } = useActiveSource(toRef(store, "activePlayer"));

// ── State ─────────────────────────────────────────────────────────────────────

const showRemainingTime = ref(false);
const isDragging = ref(false);
const curTimeValue = ref(0);
const dragEndValue = ref(0);
const pendingSeekTarget = ref<number | null>(null);

// ── Tick / rAF ────────────────────────────────────────────────────────────────

const nowTick = ref(0);
let rafId: number | null = null;
let fallbackTimer: ReturnType<typeof setInterval> | null = null;

const startTick = () => {
  if (rafId === null) {
    const tick = () => {
      const now = Date.now();
      if (now - nowTick.value >= 64) nowTick.value = now;
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

onUnmounted(stopTick);

// ── Computed ──────────────────────────────────────────────────────────────────

const canSeek = computed(() => {
  if (!activeSource.value) return false;
  if (store.activePlayer?.powered === false) return false;
  const media = store.activePlayer?.current_media;
  if (!media?.duration) return false;
  if (media.media_type === MediaType.RADIO) return false;
  return activeSource.value.can_seek;
});

const duration = computed(
  () => store.activePlayer?.current_media?.duration || 1,
);

const playerCurTimeStr = computed(() => {
  if (showRemainingTime.value && store.activePlayer?.current_media?.duration) {
    const remaining =
      store.activePlayer.current_media.duration - curTimeValue.value;
    return `-${formatDuration(remaining)}`;
  }
  return formatDuration(curTimeValue.value);
});

const playerTotalTimeStr = computed(() => {
  const duration = store.activePlayer?.current_media?.duration;
  if (
    !duration ||
    store.activePlayer?.current_media?.media_type === MediaType.RADIO
  )
    return "";
  return formatDuration(duration);
});

const computedElapsedTime = computed(() => {
  void nowTick.value;

  const isPlaying = store.activePlayer?.playback_state === "playing";
  const usingQueue = !!(
    store.activePlayerQueue && store.activePlayerQueue.active
  );
  const hasCurrentMedia =
    store.activePlayer?.current_media?.elapsed_time != null;

  if (isPlaying && (usingQueue || hasCurrentMedia)) startTick();
  else stopTick();

  if (isDragging.value) return curTimeValue.value;

  const queue = store.activePlayerQueue;
  const queueId = queue?.queue_id;
  const queueTime = queueId ? api.queueElapsedTime[queueId] : undefined;
  if (
    queueTime?.elapsed_time != null &&
    queueTime?.elapsed_time_last_updated != null
  ) {
    return (
      computeElapsedTime(
        queueTime.elapsed_time,
        queueTime.elapsed_time_last_updated,
        queue!.state,
      ) ?? 0
    );
  }

  const currentMedia = store.activePlayer?.current_media;
  if (
    currentMedia?.elapsed_time != null &&
    currentMedia?.elapsed_time_last_updated != null
  ) {
    return (
      computeElapsedTime(
        currentMedia.elapsed_time,
        currentMedia.elapsed_time_last_updated,
        store.activePlayer?.playback_state,
      ) ?? 0
    );
  }

  const player = store.activePlayer;
  if (
    player?.elapsed_time != null &&
    player?.elapsed_time_last_updated != null
  ) {
    return (
      computeElapsedTime(
        player.elapsed_time,
        player.elapsed_time_last_updated,
        player?.playback_state,
      ) ?? 0
    );
  }

  return 0;
});

const chapterTicks = computed(() => {
  const ticks: Record<number, string> = {};
  store.curQueueItem?.media_item?.metadata?.chapters?.forEach((chapter) => {
    ticks[chapter.start] = chapter.name;
  });
  return ticks;
});

// ── Watch ─────────────────────────────────────────────────────────────────────

watch(computedElapsedTime, (newTime) => {
  if (isDragging.value) return;
  if (pendingSeekTarget.value != null) {
    if (Math.abs(newTime - pendingSeekTarget.value) < 2) {
      pendingSeekTarget.value = null;
    } else {
      return;
    }
  }
  curTimeValue.value = newTime;
});

// ── Seek handlers ─────────────────────────────────────────────────────────────

const onSeekStart = () => {
  isDragging.value = true;
};

let keySeekTimer: ReturnType<typeof setTimeout> | null = null;

const onSeekEnd = (value: number) => {
  dragEndValue.value = value;

  // Debounce so rapid key presses coalesce into a single seek command.
  if (keySeekTimer) clearTimeout(keySeekTimer);
  keySeekTimer = setTimeout(() => {
    isDragging.value = false;
    if (store.activePlayer) {
      pendingSeekTarget.value = dragEndValue.value;
      api.playerCommandSeek(
        store.activePlayer.player_id,
        Math.round(dragEndValue.value),
      );
    }
  }, 300);
};

// ── Chapter click ─────────────────────────────────────────────────────────────

const chapterClicked = (chapterPos: number) => {
  const chapters = store.curQueueItem?.media_item?.metadata?.chapters;
  if (!chapters) return;
  const chapter = chapters.find((c) => c.start === chapterPos);
  if (chapter) {
    api.playMedia(
      store.curQueueItem!.media_item!.uri,
      undefined,
      undefined,
      chapter.position.toString(),
    );
  }
};
</script>

<style scoped>
.timeline-container {
  width: 100%;
  --timeline-color: rgb(var(--v-theme-primary));
}

.time-text-left {
  text-align: left;
  display: table-cell;
}

.time-text-right {
  text-align: right;
  display: table-cell;
}

.time-text-row {
  cursor: pointer;
  height: 8px;
  opacity: 0.6;
  display: flex;
  flex: 1 1 auto;
  margin-top: -10px;
  margin-bottom: 5px;
}

.time-text-row > div {
  width: 50%;
}
</style>
