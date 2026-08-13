<template>
  <Dialog v-model:open="open">
    <DialogContent class="playback-speed-dialog">
      <DialogHeader>
        <DialogTitle>{{ $t("change_playback_speed") }}</DialogTitle>
      </DialogHeader>
      <div class="playback-speed-current">
        {{ formatSpeed(currentPlaybackSpeed) }}
      </div>
      <Slider
        :model-value="[sliderPlaybackSpeed]"
        :min="PLAYBACK_SPEED_SLIDER_MIN"
        :max="PLAYBACK_SPEED_SLIDER_MAX"
        :step="0.05"
        class="playback-speed-slider"
        @update:model-value="onSliderPlaybackSpeed"
      />
      <div class="playback-speed-options">
        <Button
          v-for="option in PLAYBACK_SPEED_OPTIONS"
          :key="option"
          :variant="option === currentPlaybackSpeed ? 'default' : 'outline'"
          @click="onSelectPlaybackSpeed(option)"
        >
          {{ formatSpeed(option) }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { queueItemPlaybackSpeed } from "@/helpers/elapsed";
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import { computed, onBeforeUnmount, ref, watch } from "vue";

const PLAYBACK_SPEED_OPTIONS = [1, 1.25, 1.5, 2, 3] as const;
const PLAYBACK_SPEED_SLIDER_MIN = 0.5;
const PLAYBACK_SPEED_SLIDER_MAX = 2;

const open = defineModel<boolean>("open", { required: true });

const currentPlaybackSpeed = ref<number>(1);

const formatSpeed = (value: number) =>
  Number.isInteger(value) ? value.toFixed(1) : value.toString();

// Slider only spans 0.5–2.0; values outside (e.g. the 3.0 preset) peg the
// thumb at the corresponding end so the slider stays in sync visually.
const sliderPlaybackSpeed = computed(() =>
  Math.min(
    PLAYBACK_SPEED_SLIDER_MAX,
    Math.max(PLAYBACK_SPEED_SLIDER_MIN, currentPlaybackSpeed.value),
  ),
);

watch(
  () => store.curQueueItem,
  (queueItem) => {
    currentPlaybackSpeed.value = queueItemPlaybackSpeed(queueItem);
  },
  { immediate: true },
);

// Debounce backend updates so dragging the slider doesn't spam the API —
// only the value held for >=1s gets sent. If the dialog is closed before
// the timer fires, the pending change is flushed immediately.
const PLAYBACK_SPEED_DEBOUNCE_MS = 1000;
let speedDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSpeed: {
  value: number;
  queueId: string;
  queueItemId: string;
} | null = null;

const flushPendingSpeed = () => {
  if (speedDebounceTimer !== null) {
    clearTimeout(speedDebounceTimer);
    speedDebounceTimer = null;
  }
  if (!pendingSpeed) return;
  const { value, queueId, queueItemId } = pendingSpeed;
  pendingSpeed = null;
  api.queueCommandSetPlaybackSpeed(queueId, value, queueItemId);
};

const applyPlaybackSpeed = (value: number) => {
  currentPlaybackSpeed.value = value;
  const queueItem = store.curQueueItem;
  if (!queueItem) return;
  pendingSpeed = {
    value,
    queueId: queueItem.queue_id,
    queueItemId: queueItem.queue_item_id,
  };
  if (speedDebounceTimer !== null) clearTimeout(speedDebounceTimer);
  speedDebounceTimer = setTimeout(
    flushPendingSpeed,
    PLAYBACK_SPEED_DEBOUNCE_MS,
  );
};

const onSelectPlaybackSpeed = (value: number) => {
  applyPlaybackSpeed(value);
};

const onSliderPlaybackSpeed = (value: number[] | undefined) => {
  if (!value || value.length === 0) return;
  applyPlaybackSpeed(Math.round(value[0] * 100) / 100);
};

watch(open, (isOpen) => {
  // the fullscreen player leaves escape to whatever dialog is on top of it
  store.dialogActive = isOpen;
  // Sync from the latest queue state on open so the displayed value is
  // current even if the queue item updated since the dialog was last used.
  if (isOpen) {
    currentPlaybackSpeed.value = queueItemPlaybackSpeed(store.curQueueItem);
    return;
  }
  // Flush any pending change as soon as the dialog closes, so the user's
  // final selection is sent even if they close before the 1s window elapses.
  flushPendingSpeed();
});

onBeforeUnmount(() => {
  // the flag is app-wide and nothing else would clear it, so it cannot be left
  // behind by a host that goes away while this is still showing
  if (open.value) store.dialogActive = false;
  flushPendingSpeed();
});
</script>

<style scoped>
.playback-speed-dialog {
  width: 360px;
  /* Both insets, so a dialog wide enough to be clamped still stops at the far
     safe edge rather than running past it. */
  max-width: calc(
    100vw - 2rem - var(--device-inset-left) - var(--device-inset-right)
  ) !important;
}

.playback-speed-current {
  text-align: center;
  font-size: 1.5rem;
  font-variant-numeric: tabular-nums;
  padding: 4px 0 8px;
  opacity: 0.85;
}

.playback-speed-slider {
  width: 100%;
  margin-bottom: 12px;
}

.playback-speed-options {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  justify-content: center;
  padding: 4px 0 0;
}

.playback-speed-options > * {
  flex: 1 1 0;
  min-width: 0;
  border: 1px solid var(--border, hsl(var(--border, 0 0% 80%)));
  border-radius: 8px;
  font-variant-numeric: tabular-nums;
}
</style>
