<template>
  <div ref="wrapperRef" class="player-volume-wrapper">
    <!-- Sonos-style group volume popout (teleported to body to escape overflow clipping) -->
    <Teleport to="body">
      <!-- Invisible backdrop: catches all clicks/taps outside the popout and stops propagation -->
      <Transition name="popout-backdrop">
        <div
          v-if="showGroupPopout"
          class="group-popout-backdrop"
          @click.stop.prevent="closeGroupPopout"
          @touchstart.stop.prevent="closeGroupPopout"
          @mousedown.stop.prevent
          @touchmove.stop.prevent
          @touchend.stop.prevent
        ></div>
      </Transition>
      <Transition name="popout">
        <div
          v-if="showGroupPopout"
          ref="popoutRef"
          class="group-popout"
          :style="popoutStyle"
          @click.stop
          @touchstart.stop
          @touchmove.stop
          @touchend.stop
        >
          <!-- Drag handle for swipe-down-to-dismiss -->
          <div
            class="group-popout-drag-handle"
            @touchstart.stop="onDragHandleTouchStart"
            @touchmove.stop="onDragHandleTouchMove"
            @touchend.stop="onDragHandleTouchEnd"
            @touchcancel.stop="onDragHandleTouchCancel"
          >
            <div class="group-popout-drag-handle-pill"></div>
          </div>
          <div
            v-for="child in childPlayers"
            :key="child.player_id"
            class="group-popout-row"
          >
            <div class="group-popout-label">
              {{ truncateString(child.name, 20) }}
            </div>
            <PlayerVolume :player="child" width="100%" />
          </div>
          <!-- Group volume at bottom with divider -->
          <div class="group-popout-divider"></div>
          <div class="group-popout-row">
            <PlayerVolume
              :player="player"
              :prefer-group-volume="true"
              :enable-popout="false"
              width="100%"
            />
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Main volume slider -->
    <div
      ref="sliderContainerRef"
      class="player-volume-container"
      :class="{
        disabled: isDisabled,
        muted: isMuted,
        'not-powered': player.powered == false,
      }"
      :style="{ width: width }"
      @click="onSliderClick"
      @wheel.prevent="onWheel"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchCancel"
    >
      <!-- Mute button with dynamic volume icon -->
      <div class="volume-prepend" @touchstart.stop @touchend.stop>
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
  </div>
</template>

<script setup lang="ts">
import { Slider } from "@/components/ui/slider";
import { getVolumeIconComponent, truncateString } from "@/helpers/utils";
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
  /** When true and the player has group members, use group volume and enable popout on tap */
  preferGroupVolume?: boolean;
  /** Enable the Sonos-style group popout (set false when parent already shows child players) */
  enablePopout?: boolean;
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
  enablePopout: true,
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

// --- Group popout ---

const showGroupPopout = ref(false);
const wrapperRef = ref<HTMLElement | null>(null);
const popoutRef = ref<HTMLElement | null>(null);
const popoutStyle = ref<Record<string, string>>({});
let lastPopoutToggleTime = 0;

const childPlayers = computed(() => {
  if (!isGroup.value) return [];
  const items: Player[] = [];
  for (const childId of props.player.group_members) {
    const child = api?.players[childId];
    if (
      child &&
      child.available &&
      child.volume_control != PLAYER_CONTROL_NONE
    ) {
      items.push(child);
    }
  }
  items.sort((a, b) => (a.name.toUpperCase() > b.name.toUpperCase() ? 1 : -1));
  return items;
});

const hasGroupPopout = computed(
  () =>
    props.enablePopout && useGroupVolume.value && childPlayers.value.length > 0,
);

const POPOUT_MIN_WIDTH = 300;
const POPOUT_MARGIN = 8;

const updatePopoutPosition = () => {
  if (!wrapperRef.value) return;
  const rect = wrapperRef.value.getBoundingClientRect();
  // Align popout bottom with wrapper bottom so the group volume slider overlaps the main one
  const bottom = `${window.innerHeight - rect.bottom}px`;

  if (store.mobileLayout) {
    // Full width with padding on mobile
    popoutStyle.value = {
      position: "fixed",
      bottom,
      left: `${POPOUT_MARGIN}px`,
      right: `${POPOUT_MARGIN}px`,
    };
  } else {
    // Desktop: use wrapper width but at least POPOUT_MIN_WIDTH, centered
    // on the wrapper, clamped to viewport edges
    const popoutWidth = Math.max(rect.width, POPOUT_MIN_WIDTH);
    const wrapperCenter = rect.left + rect.width / 2;
    let left = wrapperCenter - popoutWidth / 2;

    // Clamp to viewport edges
    if (left < POPOUT_MARGIN) left = POPOUT_MARGIN;
    if (left + popoutWidth > window.innerWidth - POPOUT_MARGIN) {
      left = window.innerWidth - POPOUT_MARGIN - popoutWidth;
    }

    popoutStyle.value = {
      position: "fixed",
      bottom,
      left: `${left}px`,
      width: `${popoutWidth}px`,
    };
  }
};

const toggleGroupPopout = () => {
  if (!showGroupPopout.value) {
    updatePopoutPosition();
  }
  showGroupPopout.value = !showGroupPopout.value;
  lastPopoutToggleTime = Date.now();
};

const closeGroupPopout = () => {
  // Guard against synthesized click: browser fires click ~300ms after
  // the touchend that opened the popout, hitting the newly-appeared backdrop
  if (Date.now() - lastPopoutToggleTime < 500) return;
  showGroupPopout.value = false;
  lastPopoutToggleTime = Date.now();
};

// --- Drag handle for swipe-down-to-dismiss ---

const dragHandleStartY = ref(0);
const dragHandleDeltaY = ref(0);
const isDragHandleDragging = ref(false);

const onDragHandleTouchStart = (event: TouchEvent) => {
  const touch = event.touches[0];
  dragHandleStartY.value = touch.clientY;
  dragHandleDeltaY.value = 0;
  isDragHandleDragging.value = true;
};

const onDragHandleTouchMove = (event: TouchEvent) => {
  if (!isDragHandleDragging.value) return;
  const touch = event.touches[0];
  dragHandleDeltaY.value = touch.clientY - dragHandleStartY.value;

  // Only allow downward drag — apply transform to the popout
  if (popoutRef.value && dragHandleDeltaY.value > 0) {
    popoutRef.value.style.transform = `translateY(${dragHandleDeltaY.value}px)`;
    popoutRef.value.style.transition = "none";
  }
};

const onDragHandleTouchEnd = () => {
  isDragHandleDragging.value = false;

  // If dragged down more than 50px, dismiss the popout
  if (dragHandleDeltaY.value > 50) {
    closeGroupPopout();
  }

  // Reset transform
  if (popoutRef.value) {
    popoutRef.value.style.transform = "";
    popoutRef.value.style.transition = "";
  }
  dragHandleDeltaY.value = 0;
};

const onDragHandleTouchCancel = () => {
  isDragHandleDragging.value = false;
  if (popoutRef.value) {
    popoutRef.value.style.transform = "";
    popoutRef.value.style.transition = "";
  }
  dragHandleDeltaY.value = 0;
};

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
    // Group player with popout: toggle the popout on tap
    if (hasGroupPopout.value) {
      toggleGroupPopout();
    } else {
      // Single player: tap before/after handle for volume up/down
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
    }
  } else {
    // Drag end: send the final absolute value to the server
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

// Desktop: click on slider area toggles popout for group players
const onSliderClick = () => {
  // Only toggle for group players; skip if touch-driven, mid-drag,
  // or within 500ms of a touch-driven toggle (prevents synthesized click)
  if (!hasGroupPopout.value || isTouching.value || isDragging.value) return;
  if (Date.now() - lastPopoutToggleTime < 500) return;
  toggleGroupPopout();
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
.player-volume-wrapper {
  position: relative;
  width: 100%;
}

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

/* --- Group volume popout styles are in the unscoped style block below --- */

@media (pointer: coarse) {
  .volume-slider,
  .volume-slider :deep(*) {
    pointer-events: none;
  }
}
</style>

<!-- Unscoped styles for the teleported popout -->
<style>
.group-popout-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  background: transparent;
}

.group-popout {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), 0.12);
  border-radius: 12px;
  padding: 8px 18px 16px 18px;
  box-shadow:
    0 -4px 16px rgba(0, 0, 0, 0.15),
    0 -1px 4px rgba(0, 0, 0, 0.08);
  z-index: 10001;
}

.group-popout-row {
  margin-bottom: 8px;
}

.group-popout-row:last-child {
  margin-bottom: 0;
}

.group-popout-label {
  font-size: 0.85rem;
  font-weight: 500;
  opacity: 0.85;
  padding-left: 2px;
  margin-bottom: -2px;
}

.group-popout-label-group {
  font-weight: 600;
  opacity: 1;
}

.group-popout-divider {
  height: 1px;
  background: rgba(var(--v-border-color), 0.15);
  margin: 6px 0;
}

/* Drag handle for swipe-down-to-dismiss (touch only) */
.group-popout-drag-handle {
  display: none;
  justify-content: center;
  align-items: center;
  padding: 4px 0 10px 0;
  cursor: grab;
  touch-action: none;
}

@media (pointer: coarse) {
  .group-popout-drag-handle {
    display: flex;
  }
}

.group-popout-drag-handle-pill {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: rgba(var(--v-border-color), 0.3);
  transition: background 0.15s ease;
}

.group-popout-drag-handle:active .group-popout-drag-handle-pill {
  background: rgba(var(--v-border-color), 0.5);
}

/* Popout animation */
.popout-enter-active,
.popout-leave-active {
  transition: all 0.2s ease;
}

.popout-enter-from,
.popout-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.popout-enter-to,
.popout-leave-from {
  opacity: 1;
  transform: translateY(0);
}

/* Backdrop animation */
.popout-backdrop-enter-active,
.popout-backdrop-leave-active {
  transition: opacity 0.2s ease;
}

.popout-backdrop-enter-from,
.popout-backdrop-leave-to {
  opacity: 0;
}

.popout-backdrop-enter-to,
.popout-backdrop-leave-from {
  opacity: 1;
}
</style>
