<template>
  <div
    ref="sliderContainerRef"
    class="player-volume-container"
    :class="{
      disabled: isDisabled,
      muted: isMuted,
      'not-powered': player.powered == false,
    }"
    :style="{ width: width }"
    @wheel.prevent="onWheel"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
    @touchcancel="onTouchCancel"
  >
    <!-- Prepend slot override (used by VolumeBtn for menu activator) -->
    <div
      v-if="$slots.prepend"
      class="volume-prepend"
      @touchstart.stop
      @touchend.stop
    >
      <slot name="prepend"></slot>
    </div>

    <!-- Mute button with dynamic volume icon (default) -->
    <div v-else class="volume-prepend" @touchstart.stop @touchend.stop>
      <button
        class="volume-icon-btn"
        :disabled="muteDisabled"
        @click.stop="onMuteToggle"
      >
        <component :is="volumeIconComponent" :size="iconSize" />
      </button>
    </div>

    <Slider
      :model-value="[displayValue]"
      :disabled="isSliderDisabled"
      :min="0"
      :max="100"
      :step="step"
      class="volume-slider"
      :class="cn('w-full', props.class)"
      @update:model-value="onSliderUpdate"
    />

    <!-- Volume level display -->
    <div
      v-if="showVolumeLevel"
      class="volume-append"
      @touchstart.stop
      @touchend.stop
    >
      <span class="volume-level-text">
        {{ Math.round(displayValue) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Slider } from "@/components/ui/slider";
import { getVolumeIconComponent } from "@/helpers/utils";
import { cn } from "@/lib/utils";
import { api } from "@/plugins/api";
import {
  type Player,
  PLAYER_CONTROL_NONE,
  PlayerFeature,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computed, onUnmounted, ref, watch } from "vue";

export interface Props {
  /** The player to control — component handles all volume logic internally */
  player: Player;
  /** Show the volume level number */
  showVolumeLevel?: boolean;
  /** Size of the volume icon */
  iconSize?: number;
  disabled?: boolean;
  preferGroupVolume?: boolean;
  width?: string;
  step?: number;
  allowWheel?: boolean;
  color?: string;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  showVolumeLevel: true,
  iconSize: 22,
  disabled: false,
  preferGroupVolume: false,
  width: "100%",
  step: 2,
  allowWheel: false,
  color: "secondary",
  class: "",
});

const emit = defineEmits<{
  (e: "update:local-value", value: number): void;
}>();

// --- Player-aware computed properties ---

const isGroup = computed(
  () => props.player && props.player.group_members.length > 0,
);

const useGroupVolume = computed(() => isGroup.value && props.preferGroupVolume);

const currentVolume = computed(() => {
  return Math.round(
    useGroupVolume.value
      ? (props.player.group_volume ?? 0)
      : (props.player.volume_level ?? 0),
  );
});

const isDisabled = computed(() => {
  if (props.disabled) return true;
  return (
    !props.player.available ||
    props.player.powered == false ||
    !props.player.supported_features.includes(PlayerFeature.VOLUME_SET)
  );
});

const isMuted = computed(() => {
  return props.player.volume_muted ?? false;
});

const isSliderDisabled = computed(() => isDisabled.value || isMuted.value);

const muteDisabled = computed(() => {
  if (useGroupVolume.value) {
    return (
      !props.player.available ||
      props.player.powered == false ||
      props.player.group_volume_muted == null
    );
  }
  return (
    !props.player.available ||
    props.player.powered == false ||
    props.player.mute_control == PLAYER_CONTROL_NONE
  );
});

const volumeIconComponent = computed(() => {
  return getVolumeIconComponent(props.player, displayValue.value);
});

// --- Slider state ---

const sliderContainerRef = ref<HTMLElement | null>(null);
const displayValue = ref(currentVolume.value);

// Touch tracking
const touchStartX = ref(0);
const touchStartY = ref(0);
const touchStartValue = ref(0);
const isScrolling = ref(false);
const isDrag = ref(false);
const touchMoveCount = ref(0);
const maxMovement = ref(0);
const isTouching = ref(false);

// Dragging state: blocks server sync only while actively dragging the slider
const isDragging = ref(false);
let dragEndTimeout: ReturnType<typeof setTimeout> | null = null;

let sliderUpdateDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
const SLIDER_UPDATE_DEBOUNCE_MS = 100;

onUnmounted(() => {
  if (dragEndTimeout) clearTimeout(dragEndTimeout);
  if (sliderUpdateDebounceTimeout) clearTimeout(sliderUpdateDebounceTimeout);
});

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const roundToStep = (value: number) =>
  Math.round(value / props.step) * props.step;

// --- Drag helpers ---

const startDragging = () => {
  isDragging.value = true;
  if (dragEndTimeout) {
    clearTimeout(dragEndTimeout);
    dragEndTimeout = null;
  }
};

const stopDragging = () => {
  // Brief delay before re-enabling server sync so the server has time
  // to process the final value and we don't snap back momentarily.
  if (dragEndTimeout) clearTimeout(dragEndTimeout);
  dragEndTimeout = setTimeout(() => {
    isDragging.value = false;
    dragEndTimeout = null;
  }, 500);
};

// --- Volume API calls ---

const setVolume = (value: number) => {
  if (useGroupVolume.value) {
    api.playerCommandGroupVolume(props.player.player_id, value);
  } else {
    api.playerCommandVolumeSet(props.player.player_id, value);
  }
};

const volumeUp = () => {
  if (useGroupVolume.value) {
    api.playerCommandGroupVolumeUp(props.player.player_id);
  } else {
    api.playerCommandVolumeUp(props.player.player_id);
  }
};

const volumeDown = () => {
  if (useGroupVolume.value) {
    api.playerCommandGroupVolumeDown(props.player.player_id);
  } else {
    api.playerCommandVolumeDown(props.player.player_id);
  }
};

const onMuteToggle = () => {
  if (muteDisabled.value) return;
  if (useGroupVolume.value) {
    api.playerCommandGroupVolumeMute(
      props.player.player_id,
      !props.player.group_volume_muted,
    );
  } else {
    api.playerCommandMuteToggle(props.player.player_id);
  }
};

// --- Helpers ---

const vibrate = (duration: number = 10) => {
  if (store.isTouchscreen && "vibrate" in navigator && navigator.vibrate) {
    navigator.vibrate(duration);
  }
};

const getPercentageFromX = (clientX: number): number => {
  if (!sliderContainerRef.value) return displayValue.value;

  const rect = sliderContainerRef.value.getBoundingClientRect();
  const x = clientX - rect.left;
  const percentage = (x / rect.width) * 100;

  return clamp(roundToStep(percentage), 0, 100);
};

// --- Touch handlers ---

const onTouchStart = (event: TouchEvent) => {
  if (isSliderDisabled.value) return;

  isTouching.value = true;
  const touch = event.touches[0];
  touchStartX.value = touch.clientX;
  touchStartY.value = touch.clientY;
  touchStartValue.value = displayValue.value;
  isScrolling.value = false;
  isDrag.value = false;
  touchMoveCount.value = 0;
  maxMovement.value = 0;

  vibrate();
};

const onTouchMove = (event: TouchEvent) => {
  if (isSliderDisabled.value || isScrolling.value) return;

  const touch = event.touches[0];
  const deltaX = touch.clientX - touchStartX.value;
  const deltaY = touch.clientY - touchStartY.value;
  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);

  touchMoveCount.value++;
  maxMovement.value = Math.max(maxMovement.value, absDeltaX);

  if (!isDrag.value && !isScrolling.value) {
    if (absDeltaY > 10 && absDeltaY > absDeltaX * 2) {
      isScrolling.value = true;
      displayValue.value = touchStartValue.value;
      emit("update:local-value", touchStartValue.value);
      return;
    }

    if (absDeltaX > 8) {
      isDrag.value = true;
      startDragging();
      event.preventDefault();
    }
  }

  if (isDrag.value) {
    event.preventDefault();

    const newValue = getPercentageFromX(touch.clientX);
    const valueChanged = newValue !== displayValue.value;

    displayValue.value = newValue;
    emit("update:local-value", newValue);

    if (valueChanged) {
      vibrate(5);
    }
  }
};

const onTouchEnd = (event: TouchEvent) => {
  if (isSliderDisabled.value) return;

  if (isScrolling.value) {
    isScrolling.value = false;
    isTouching.value = false;
    return;
  }

  const isTap = !isDrag.value;

  if (isTap) {
    // Tap before/after handle: use server volume up/down commands.
    // No optimistic display update — let the server state flow through.
    // Compare tap position to the actual thumb element in screen coordinates
    // to avoid coordinate mismatch between container and slider track.
    const touch = event.changedTouches[0];
    const thumb = sliderContainerRef.value?.querySelector("[role=slider]");
    if (thumb) {
      const thumbRect = thumb.getBoundingClientRect();
      const thumbCenter = thumbRect.left + thumbRect.width / 2;
      if (touch.clientX > thumbCenter) {
        volumeUp();
      } else {
        volumeDown();
      }
    }
  } else {
    // Drag end: send the final absolute value to the server.
    const touch = event.changedTouches[0];
    const finalValue = clamp(
      roundToStep(getPercentageFromX(touch.clientX)),
      0,
      100,
    );
    displayValue.value = finalValue;
    emit("update:local-value", finalValue);
    setVolume(finalValue);
    stopDragging();
  }

  isDrag.value = false;
  touchMoveCount.value = 0;
  maxMovement.value = 0;
  isTouching.value = false;
};

const onTouchCancel = () => {
  isDrag.value = false;
  isScrolling.value = false;
  touchMoveCount.value = 0;
  maxMovement.value = 0;
  displayValue.value = touchStartValue.value;
  isDragging.value = false;
  if (dragEndTimeout) {
    clearTimeout(dragEndTimeout);
    dragEndTimeout = null;
  }
  isTouching.value = false;
};

const onWheel = (event: WheelEvent) => {
  if (!props.allowWheel || isSliderDisabled.value) return;

  // Use server volume up/down commands — no optimistic display update.
  if (event.deltaY < 0) {
    volumeUp();
  } else {
    volumeDown();
  }
};

const onSliderUpdate = (values: number[] | undefined) => {
  if (
    isSliderDisabled.value ||
    isScrolling.value ||
    isTouching.value ||
    !values
  )
    return;

  const newValue = values[0] ?? displayValue.value;
  startDragging();
  displayValue.value = newValue;
  emit("update:local-value", newValue);

  if (sliderUpdateDebounceTimeout) {
    clearTimeout(sliderUpdateDebounceTimeout);
    sliderUpdateDebounceTimeout = null;
  }

  sliderUpdateDebounceTimeout = setTimeout(() => {
    setVolume(newValue);
    sliderUpdateDebounceTimeout = null;
    stopDragging();
  }, SLIDER_UPDATE_DEBOUNCE_MS);
};

// Sync server volume to display when not actively dragging
watch(
  currentVolume,
  (val: number) => {
    if (isDragging.value) return;

    if (Math.abs(displayValue.value - val) > 0.5) {
      displayValue.value = val;
      emit("update:local-value", val);
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.player-volume-container {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  touch-action: pan-x;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.player-volume-container.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.player-volume-container.muted .volume-slider {
  opacity: 0.4;
  pointer-events: none;
}

.player-volume-container.not-powered {
  opacity: 0.5;
}

.volume-prepend,
.volume-append {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  overflow: visible;
  margin-left: 0;
  width: 30px;
  justify-content: center;
}

.volume-prepend {
  margin-right: 4px;
}

.volume-icon-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
}

.volume-icon-btn:hover {
  opacity: 1;
}

.volume-icon-btn:active {
  opacity: 0.5;
}

.volume-icon-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.volume-level-text {
  font-size: 0.75rem;
  min-width: 28px;
  text-align: center;
  opacity: 0.8;
}

@media (pointer: coarse) {
  .volume-slider {
    pointer-events: none;
  }
}
</style>
