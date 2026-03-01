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
    <div v-if="$slots.prepend" class="volume-prepend">
      <slot name="prepend" />
    </div>

    <!-- Mute button with dynamic volume icon (default) -->
    <div v-else class="volume-prepend">
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
    <div v-if="showVolumeLevel" class="volume-append">
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

const playerVolume = computed(() => {
  return Math.round(
    isGroup.value && props.preferGroupVolume
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
  if (isGroup.value && props.preferGroupVolume) {
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

// --- Slider state and mechanics ---

const sliderContainerRef = ref<HTMLElement | null>(null);
const displayValue = ref(playerVolume.value);

const touchStartX = ref(0);
const touchStartY = ref(0);
const touchStartValue = ref(0);
const isScrolling = ref(false);
const isDrag = ref(false);
const touchMoveCount = ref(0);
const maxMovement = ref(0);
const isTouching = ref(false);

const isBlocking = ref(false);
let blockingTimeout: ReturnType<typeof setTimeout> | null = null;

const startBlocking = () => {
  isBlocking.value = true;
  if (blockingTimeout) {
    clearTimeout(blockingTimeout);
  }
  blockingTimeout = setTimeout(() => {
    isBlocking.value = false;
    blockingTimeout = null;
  }, 5000);
};

const stopBlocking = () => {
  isBlocking.value = false;
  if (blockingTimeout) {
    clearTimeout(blockingTimeout);
    blockingTimeout = null;
  }
};

onUnmounted(() => {
  if (blockingTimeout) {
    clearTimeout(blockingTimeout);
  }
  if (sliderUpdateDebounceTimeout) {
    clearTimeout(sliderUpdateDebounceTimeout);
  }
});

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const roundToStep = (value: number) =>
  Math.round(value / props.step) * props.step;

// --- Volume API calls ---

const setVolume = (value: number) => {
  if (isGroup.value && props.preferGroupVolume) {
    api.playerCommandGroupVolume(props.player.player_id, value);
  } else {
    api.playerCommandVolumeSet(props.player.player_id, value);
  }
};

const onMuteToggle = () => {
  if (muteDisabled.value) return;
  if (props.preferGroupVolume && props.player.group_members.length > 0) {
    api.playerCommandGroupVolumeMute(
      props.player.player_id,
      !props.player.group_volume_muted,
    );
  } else {
    api.playerCommandMuteToggle(props.player.player_id);
  }
};

// --- Value emission ---

const emitValue = (value: number, isFinal: boolean = false) => {
  if (isSliderDisabled.value) return;

  const clampedValue = clamp(roundToStep(value), 0, 100);

  if (isFinal) {
    startBlocking();
  }

  displayValue.value = clampedValue;
  emit("update:local-value", clampedValue);

  if (isFinal) {
    setVolume(clampedValue);
  }
};

const vibrate = (duration: number = 10) => {
  if (store.isTouchscreen && "vibrate" in navigator && navigator.vibrate) {
    navigator.vibrate(duration);
  }
};

let sliderUpdateDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
const SLIDER_UPDATE_DEBOUNCE_MS = 100;

const getPercentageFromX = (clientX: number): number => {
  if (!sliderContainerRef.value) return displayValue.value;

  const rect = sliderContainerRef.value.getBoundingClientRect();
  const x = clientX - rect.left;
  const percentage = (x / rect.width) * 100;

  return clamp(roundToStep(percentage), 0, 100);
};

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

  startBlocking();
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
      stopBlocking();
      return;
    }

    if (absDeltaX > 8) {
      isDrag.value = true;
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
    const touch = event.changedTouches[0];
    const tapPercentage = getPercentageFromX(touch.clientX);

    const delta =
      tapPercentage > touchStartValue.value ? props.step : -props.step;
    const newValue = clamp(touchStartValue.value + delta, 0, 100);

    emitValue(newValue, true);
  } else {
    const touch = event.changedTouches[0];
    const finalValue = getPercentageFromX(touch.clientX);
    emitValue(finalValue, true);
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
  stopBlocking();
  isTouching.value = false;
};

const onWheel = (event: WheelEvent) => {
  if (!props.allowWheel || isSliderDisabled.value) return;

  const delta = event.deltaY < 0 ? props.step : -props.step;
  const newValue = clamp(displayValue.value + delta, 0, 100);

  startBlocking();
  emitValue(newValue, true);
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
  displayValue.value = newValue;
  emit("update:local-value", newValue);

  if (sliderUpdateDebounceTimeout) {
    clearTimeout(sliderUpdateDebounceTimeout);
    sliderUpdateDebounceTimeout = null;
  }

  sliderUpdateDebounceTimeout = setTimeout(() => {
    setVolume(newValue);
    sliderUpdateDebounceTimeout = null;
  }, SLIDER_UPDATE_DEBOUNCE_MS);
};

// Watch for external value changes from server
watch(
  () => playerVolume.value,
  (val: number) => {
    if (isBlocking.value) {
      return;
    }

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
