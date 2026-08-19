<template>
  <div ref="wrapperRef" class="player-volume-wrapper">
    <!-- Sonos-style group volume popout (teleported to body to escape overflow clipping) -->
    <Teleport to="body">
      <!-- Volume readout, teleported for the same reason: the bars this slider
           sits in clip their own overflow -->
      <Transition name="volume-bubble">
        <div
          v-if="showStepButtons"
          class="volume-bubble"
          :style="bubbleStyle"
          aria-hidden="true"
        >
          {{ Math.round(displayValue) }}
        </div>
      </Transition>
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
      data-no-panel-drag
      class="player-volume-container"
      :class="{
        disabled: isDisabled,
        muted: isMuted,
        'not-powered': player.powered == false,
        expandable: expandOnTouch,
        expanded: showStepButtons,
        'relative-mode': isRelativeMode,
      }"
      :style="{ width: width }"
      @click="onSliderClick"
      @mousedown="onMouseDown"
      @pointerdown.capture="onPointerDown"
      @pointermove.capture="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @wheel="onWheel"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchCancel"
    >
      <!-- Mute button with dynamic volume icon. The slot swallows the whole
           touch sequence, moves included: a touch that starts on a button is
           never the slider being dragged, and letting the moves through would
           measure them against whatever the last touch on the track started at. -->
      <div
        class="volume-prepend"
        @touchstart.stop
        @touchmove.stop
        @touchend.stop
        @touchcancel.stop
      >
        <button
          class="volume-icon-btn volume-slot-item"
          :class="{ 'is-hidden': showStepButtons }"
          :inert="showStepButtons"
          :disabled="muteDisabled"
          @click.stop="onMuteToggle"
        >
          <component :is="volumeIconComponent" :size="iconSize" />
        </button>
        <button
          v-if="expandOnTouch"
          type="button"
          class="volume-step-btn volume-slot-item"
          :class="{ 'is-hidden': !showStepButtons }"
          :inert="!showStepButtons"
          :aria-label="$t('tooltip.volume_down')"
          @click.stop="onStepDown"
        >
          <Minus :size="iconSize" />
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
        v-if="showVolumeLevel || expandOnTouch"
        class="volume-append"
        @touchstart.stop
        @touchmove.stop
        @touchend.stop
        @touchcancel.stop
      >
        <span
          v-if="showVolumeLevel"
          class="volume-level-text volume-slot-item"
          :class="{ 'is-hidden': showStepButtons }"
          :inert="showStepButtons"
        >
          {{ Math.round(displayValue) }}
        </span>
        <button
          v-if="expandOnTouch"
          type="button"
          class="volume-step-btn volume-slot-item"
          :class="{ 'is-hidden': !showStepButtons }"
          :inert="!showStepButtons"
          :aria-label="$t('tooltip.volume_up')"
          @click.stop="onStepUp"
        >
          <Plus :size="iconSize" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Slider } from "@/components/ui/slider";
import { useUserPreferences } from "@/composables/userPreferences";
import { deviceInset } from "@/helpers/device";
import { getVolumeIconComponent, truncateString } from "@/helpers/utils";
import { cn } from "@/lib/utils";
import { api } from "@/plugins/api";
import {
  type Player,
  PLAYER_CONTROL_NONE,
  PlayerFeature,
  PlayerType,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { Minus, Plus } from "@lucide/vue";
import { computed, nextTick, onUnmounted, ref, watch } from "vue";

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
  /** Ask the parent to expand inline group controls when the slider is tapped */
  requestExpandOnGroupTap?: boolean;
  /** Fatten the rail and swap the mute and level slots for step buttons while a finger is on it */
  expandOnTouch?: boolean;
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
  requestExpandOnGroupTap: false,
  expandOnTouch: false,
  width: "100%",
  step: 2,
  allowWheel: false,
  color: "secondary",
  class: "",
});

const emit = defineEmits<{
  (e: "toggle-group-expansion"): void;
}>();

// --- User preferences (Settings -> Frontend -> Volume control) ---

const { getPreference } = useUserPreferences();

// "absolute": the drag/tap position sets the volume. "relative": the drag
// distance adjusts the volume from the value the drag started at.
const volumeSliderMode = getPreference<string>(
  "volume_slider_mode",
  "absolute",
);
const isRelativeMode = computed(() => volumeSliderMode.value === "relative");

const hapticsEnabled = getPreference<boolean>("volume_haptics", true);

// --- Player-aware computed properties ---

const isGroup = computed(() =>
  props.player.type === PlayerType.GROUP
    ? props.player.group_members.length > 0
    : props.player.group_members.some(
        (playerId) => playerId !== props.player.player_id,
      ),
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
  return useGroupVolume.value
    ? props.player.group_volume_muted === true
    : (props.player.volume_muted ?? false);
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
  return getVolumeIconComponent(
    props.player,
    displayValue.value,
    isMuted.value,
  );
});

// --- Group popout ---

const showGroupPopout = ref(false);
const wrapperRef = ref<HTMLElement | null>(null);
const popoutRef = ref<HTMLElement | null>(null);
const popoutStyle = ref<Record<string, string>>({});
let lastPopoutToggleTime = 0;

const childPlayers = computed(() => {
  if (!isGroup.value) return [];
  const playerIds = new Set(props.player.group_members);
  if (props.player.type !== PlayerType.GROUP) {
    playerIds.add(props.player.player_id);
  }
  const items: Player[] = [];
  for (const childId of playerIds) {
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

const requestsGroupExpansion = computed(
  () =>
    props.requestExpandOnGroupTap &&
    useGroupVolume.value &&
    childPlayers.value.length > 0,
);

const handlesGroupTap = computed(
  () => hasGroupPopout.value || requestsGroupExpansion.value,
);

const POPOUT_MIN_WIDTH = 300;
const POPOUT_MARGIN = 8;

const updatePopoutPosition = () => {
  if (!wrapperRef.value) return;
  const rect = wrapperRef.value.getBoundingClientRect();
  // Align popout bottom with wrapper bottom so the group volume slider overlaps the main one
  const bottom = `${window.innerHeight - rect.bottom}px`;
  // It grows upwards from there, so a large group is capped at the room above
  const maxHeight = `${rect.bottom - POPOUT_MARGIN}px`;
  // The popout is teleported out to the body, so the padding its container
  // keeps clear of the cutout never reaches it and it holds the margin off the
  // safe edges itself
  const insetLeft = deviceInset("left");
  const insetRight = deviceInset("right");

  if (store.mobileLayout) {
    // Full width with padding on mobile
    popoutStyle.value = {
      position: "fixed",
      bottom,
      maxHeight,
      left: `${POPOUT_MARGIN + insetLeft}px`,
      right: `${POPOUT_MARGIN + insetRight}px`,
    };
  } else {
    // Desktop: use wrapper width but at least POPOUT_MIN_WIDTH, centered
    // on the wrapper, clamped to the safe edges
    const popoutWidth = Math.max(rect.width, POPOUT_MIN_WIDTH);
    const wrapperCenter = rect.left + rect.width / 2;
    let left = wrapperCenter - popoutWidth / 2;

    // Clamp to the safe edges
    if (left < POPOUT_MARGIN + insetLeft) left = POPOUT_MARGIN + insetLeft;
    if (left + popoutWidth > window.innerWidth - POPOUT_MARGIN - insetRight) {
      left = window.innerWidth - POPOUT_MARGIN - insetRight - popoutWidth;
    }

    popoutStyle.value = {
      position: "fixed",
      bottom,
      maxHeight,
      left: `${left}px`,
      width: `${popoutWidth}px`,
    };
  }
};

const toggleGroupPopout = () => {
  if (!showGroupPopout.value) {
    updatePopoutPosition();
    // The group slider is the last row, so a capped list has to open scrolled
    // to the bottom to keep it over the slider that was tapped
    nextTick(() => {
      if (popoutRef.value) {
        popoutRef.value.scrollTop = popoutRef.value.scrollHeight;
      }
    });
  }
  showGroupPopout.value = !showGroupPopout.value;
  lastPopoutToggleTime = Date.now();
};

const handleGroupTap = () => {
  // the group controls carry their own volume rows, so the bar's own step
  // buttons must not linger behind them
  collapseControls();
  if (hasGroupPopout.value) {
    toggleGroupPopout();
  } else {
    lastPopoutToggleTime = Date.now();
    emit("toggle-group-expansion");
  }
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
const touchStartThumbCenter = ref<number | null>(null);
// The position at which the gesture crossed the 8px mark and became a drag.
// Relative adjustments are measured from here, so the travel spent recognising
// the drag is not itself a volume change.
const touchDragAnchorX = ref(0);
const isScrolling = ref(false);
const isDrag = ref(false);
const touchMoveCount = ref(0);
const maxMovement = ref(0);
const isTouching = ref(false);

// Dragging state: blocks server sync only while actively dragging the slider
const isDragging = ref(false);
let dragEndTimeout: ReturnType<typeof setTimeout> | null = null;
let pointerStartX: number | null = null;
let pointerStartValue = 0;
let pointerMoved = false;

// Mouse drag tracking (relative mode only)
const isMouseDragging = ref(false);
const mouseStartX = ref(0);
const mouseStartValue = ref(0);

let sliderUpdateDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
const SLIDER_UPDATE_DEBOUNCE_MS = 100;
const POINTER_DRAG_THRESHOLD = 4;

// Live drag updates: the volume follows the finger instead of waiting for
// release. Throttled because every send is a separate websocket command.
const LIVE_SEND_THROTTLE_MS = 100;
const MAX_GROUP_LIVE_SEND_THROTTLE_MS = 500;

// A group command is applied to every member in parallel and each member's state
// change is broadcast to every connected client, so one command costs about as
// much as the group has members. Widening the window in step keeps that near
// what a single player costs, capped so a large group still tracks the finger.
const liveSendThrottleMs = computed(() =>
  useGroupVolume.value
    ? Math.min(
        MAX_GROUP_LIVE_SEND_THROTTLE_MS,
        LIVE_SEND_THROTTLE_MS * Math.max(1, childPlayers.value.length),
      )
    : LIVE_SEND_THROTTLE_MS,
);
let liveSendTimeout: ReturnType<typeof setTimeout> | null = null;
// Both reset in startDragging: a fresh gesture sends at once rather than waiting
// out the previous one's window, and an external volume change between drags can
// never make its first send look redundant.
let lastLiveSendTime = 0;
let lastSentValue: number | null = null;

// Relative mode: the drag *distance* is applied to the value the drag started
// from, at reduced speed so small adjustments are easier to land.
const RELATIVE_DRAG_SENSITIVITY = 0.5;
// Below this a relative-mode mouse gesture counts as a click, not a drag
const MOUSE_DRAG_THRESHOLD_PX = 5;

onUnmounted(() => {
  if (dragEndTimeout) clearTimeout(dragEndTimeout);
  if (sliderUpdateDebounceTimeout) clearTimeout(sliderUpdateDebounceTimeout);
  if (liveSendTimeout) clearTimeout(liveSendTimeout);
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", onMouseUp);
  stopTrackingBubble();
  cancelCollapse();
});

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const roundToStep = (value: number) =>
  Math.round(value / props.step) * props.step;

// --- Drag helpers ---

const startDragging = () => {
  isDragging.value = true;
  lastSentValue = null;
  lastLiveSendTime = 0;
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

const cancelLiveSend = () => {
  if (liveSendTimeout) {
    clearTimeout(liveSendTimeout);
    liveSendTimeout = null;
  }
};

// Sends straight away when the last send is old enough, otherwise schedules a
// trailing send that picks up whatever the value has become by the time it fires.
const sendVolumeLive = (value: number) => {
  // Wandering back onto the value already sent leaves nothing to schedule, and
  // any send still pending for the value in between is now moot.
  if (value === lastSentValue) {
    cancelLiveSend();
    return;
  }

  const throttleMs = liveSendThrottleMs.value;
  const elapsed = Date.now() - lastLiveSendTime;
  if (elapsed >= throttleMs) {
    cancelLiveSend();
    lastLiveSendTime = Date.now();
    lastSentValue = value;
    setVolume(value);
    return;
  }

  cancelLiveSend();
  liveSendTimeout = setTimeout(() => {
    liveSendTimeout = null;
    lastLiveSendTime = Date.now();
    lastSentValue = displayValue.value;
    setVolume(displayValue.value);
  }, throttleMs - elapsed);
};

// Settles the gesture on this value, cancelling any pending throttled send
// rather than racing it.
const sendVolumeFinal = (value: number) => {
  cancelLiveSend();
  if (value === lastSentValue) return;
  lastLiveSendTime = Date.now();
  lastSentValue = value;
  setVolume(value);
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

// --- Touch expansion ---

const isExpanded = ref(false);
const bubbleStyle = ref<Record<string, string>>({});
let collapseTimeout: ReturnType<typeof setTimeout> | null = null;
let bubbleFrame: number | null = null;
const COLLAPSE_DELAY_MS = 2000;
const BUBBLE_GAP = 10;

// The step buttons take over the mute and level slots, so a slider that cannot
// be dragged keeps the mute button the user needs to get out of that state
const showStepButtons = computed(
  () => props.expandOnTouch && !isSliderDisabled.value && isExpanded.value,
);

// Only the touch handlers reach this: a pointer hits the resting rail
// accurately enough, so growing it under a mouse would be noise
const expandControls = () => {
  if (!props.expandOnTouch || isSliderDisabled.value) return;
  // placed before the readout renders, so it never shows up at the last
  // position it was dismissed from
  updateBubblePosition();
  isExpanded.value = true;
  cancelCollapse();
};

const collapseControlsSoon = () => {
  if (!isExpanded.value) return;
  cancelCollapse();
  collapseTimeout = setTimeout(() => {
    isExpanded.value = false;
    collapseTimeout = null;
  }, COLLAPSE_DELAY_MS);
};

const collapseControls = () => {
  cancelCollapse();
  isExpanded.value = false;
};

const onStepDown = () => {
  expandControls();
  volumeDown();
  collapseControlsSoon();
};

const onStepUp = () => {
  expandControls();
  volumeUp();
  collapseControlsSoon();
};

const cancelCollapse = () => {
  if (collapseTimeout) {
    clearTimeout(collapseTimeout);
    collapseTimeout = null;
  }
};

// The readout rides the thumb, which sits at the value's fraction of the track
// because the slider aligns its thumb by overflow rather than inset. It is
// fixed to the viewport to clear the bars' own clipping, so it is re-measured
// rather than assumed: the rail thickens under it, and the panel it sits in can
// still be sliding open or scrolling.
const updateBubblePosition = () => {
  const track = sliderContainerRef.value?.querySelector(
    '[data-slot="slider-track"]',
  );
  if (!track) return;
  const rect = track.getBoundingClientRect();
  const left = `${rect.left + (clamp(displayValue.value, 0, 100) / 100) * rect.width}px`;
  const bottom = `${window.innerHeight - rect.top + BUBBLE_GAP}px`;
  // settling on a position ends the re-renders until something moves again
  if (bubbleStyle.value.left === left && bubbleStyle.value.bottom === bottom) {
    return;
  }
  bubbleStyle.value = { left, bottom };
};

const trackBubble = () => {
  updateBubblePosition();
  bubbleFrame = requestAnimationFrame(trackBubble);
};

const stopTrackingBubble = () => {
  if (bubbleFrame === null) return;
  cancelAnimationFrame(bubbleFrame);
  bubbleFrame = null;
};

// --- Helpers ---

const vibrate = (duration: number = 10) => {
  if (!hapticsEnabled.value) return;
  if (store.isTouchscreen && "vibrate" in navigator && navigator.vibrate) {
    navigator.vibrate(duration);
  }
};

const getThumbCenter = (): number | null => {
  const thumb = sliderContainerRef.value?.querySelector("[role=slider]");
  if (!thumb) return null;
  const rect = thumb.getBoundingClientRect();
  return rect.left + rect.width / 2;
};

// Absolute mode: the pointer position maps directly onto the 0-100 range.
const getPercentageFromX = (clientX: number): number => {
  if (!sliderContainerRef.value) return displayValue.value;

  const rect = sliderContainerRef.value.getBoundingClientRect();
  const x = clientX - rect.left;
  const percentage = (x / rect.width) * 100;

  return clamp(roundToStep(percentage), 0, 100);
};

// Relative mode: deltaX is the travel since the gesture was recognised as a
// drag, applied to the value it started from at reduced sensitivity.
const getValueFromDelta = (startValue: number, deltaX: number): number => {
  if (!sliderContainerRef.value) return displayValue.value;

  const rect = sliderContainerRef.value.getBoundingClientRect();
  const deltaPercent = (deltaX / rect.width) * 100 * RELATIVE_DRAG_SENSITIVITY;

  return clamp(roundToStep(startValue + deltaPercent), 0, 100);
};

// Resolves a touch drag position through whichever mode is active.
const getDragValue = (clientX: number): number =>
  isRelativeMode.value
    ? getValueFromDelta(touchStartValue.value, clientX - touchDragAnchorX.value)
    : getPercentageFromX(clientX);

// --- Touch handlers ---

const onTouchStart = (event: TouchEvent) => {
  if (isSliderDisabled.value && !handlesGroupTap.value) return;

  isTouching.value = true;
  const touch = event.touches[0];
  touchStartX.value = touch.clientX;
  touchStartY.value = touch.clientY;
  touchDragAnchorX.value = touch.clientX;
  touchStartValue.value = displayValue.value;
  isScrolling.value = false;
  isDrag.value = false;
  touchMoveCount.value = 0;
  maxMovement.value = 0;
  // read before expanding: the rail's ends draw in as it grows, so measuring at
  // touchend would compare the tap against a thumb that has since moved
  touchStartThumbCenter.value = getThumbCenter();

  // a group slider answers a tap by opening its own volume controls, so it waits
  // for a drag rather than swapping its buttons out from under the tap
  if (!handlesGroupTap.value) expandControls();
  vibrate();
};

const onTouchMove = (event: TouchEvent) => {
  if ((isSliderDisabled.value && !handlesGroupTap.value) || isScrolling.value) {
    return;
  }

  const touch = event.touches[0];
  const deltaX = touch.clientX - touchStartX.value;
  const deltaY = touch.clientY - touchStartY.value;
  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);

  touchMoveCount.value++;
  maxMovement.value = Math.max(maxMovement.value, absDeltaX);

  if (isSliderDisabled.value) {
    if (absDeltaY > 10 && absDeltaY > absDeltaX * 2) {
      isScrolling.value = true;
    } else if (absDeltaX > 8) {
      isDrag.value = true;
    }
    return;
  }

  if (!isDrag.value && !isScrolling.value) {
    // A non-cancelable move means the browser already owns the gesture (panning
    // the group popout), so a drag from here would fight a scroll it cannot stop
    if (!event.cancelable || (absDeltaY > 10 && absDeltaY > absDeltaX * 2)) {
      isScrolling.value = true;
      // the panels these sliders sit in scroll, so a list of them must not be
      // left fattened in the wake of a swipe
      collapseControls();
      displayValue.value = touchStartValue.value;
      return;
    }

    if (absDeltaX > 8) {
      isDrag.value = true;
      touchDragAnchorX.value = touch.clientX;
      expandControls();
      startDragging();
      event.preventDefault();
    }
  }

  if (isDrag.value) {
    event.preventDefault();

    const newValue = getDragValue(touch.clientX);
    const valueChanged = newValue !== displayValue.value;

    displayValue.value = newValue;

    if (valueChanged) {
      vibrate(5);
      sendVolumeLive(newValue);
    }
  }
};

const onTouchEnd = (event: TouchEvent) => {
  // ahead of the guard: a player that goes unavailable mid-touch would
  // otherwise leave the slider latched open, to expand again on its own the
  // moment it comes back
  collapseControlsSoon();
  // ahead of the guards too: every branch below settles the volume itself, so a
  // throttled send must never outlive the gesture that queued it
  cancelLiveSend();
  if (isSliderDisabled.value && !handlesGroupTap.value) return;

  if (isScrolling.value) {
    isScrolling.value = false;
    isTouching.value = false;
    return;
  }

  const isTap = !isDrag.value;

  if (isTap) {
    if (handlesGroupTap.value) {
      if (sliderUpdateDebounceTimeout) {
        clearTimeout(sliderUpdateDebounceTimeout);
        sliderUpdateDebounceTimeout = null;
      }
      displayValue.value = touchStartValue.value;
      handleGroupTap();
    } else if (!isSliderDisabled.value) {
      // Single player: tap before/after handle for volume up/down
      const touch = event.changedTouches[0];
      const thumbCenter = touchStartThumbCenter.value ?? getThumbCenter();
      if (thumbCenter !== null) {
        if (touch.clientX > thumbCenter) {
          volumeUp();
        } else {
          volumeDown();
        }
      }
    }
  } else if (!isSliderDisabled.value) {
    // Drag end: settle on the exact value the gesture ended at
    const touch = event.changedTouches[0];
    const finalValue = getDragValue(touch.clientX);
    displayValue.value = finalValue;
    sendVolumeFinal(finalValue);
    stopDragging();
  }

  isDrag.value = false;
  touchMoveCount.value = 0;
  maxMovement.value = 0;
  isTouching.value = false;
};

const onPointerDown = (event: PointerEvent) => {
  const targetsSlider =
    event.target instanceof Element &&
    event.target.closest('[data-slot="slider"]');
  if (event.pointerType === "touch") {
    if (targetsSlider) isTouching.value = true;
    return;
  }
  if (!handlesGroupTap.value || !targetsSlider) {
    return;
  }
  pointerStartX = event.clientX;
  pointerStartValue = displayValue.value;
  pointerMoved = false;
};

const onPointerMove = (event: PointerEvent) => {
  if (pointerStartX === null) return;
  if (Math.abs(event.clientX - pointerStartX) > POINTER_DRAG_THRESHOLD) {
    pointerMoved = true;
  }
};

const onPointerUp = () => {
  collapseControlsSoon();
  if (pointerStartX === null) return;
  const shouldExpand = !pointerMoved;
  resetPointerInteraction();
  if (!shouldExpand) {
    lastPopoutToggleTime = Date.now();
    if (!sliderUpdateDebounceTimeout) {
      if (isSliderDisabled.value) {
        isDragging.value = false;
        displayValue.value = pointerStartValue;
      } else {
        setVolume(displayValue.value);
        stopDragging();
      }
    }
    return;
  }

  if (sliderUpdateDebounceTimeout) {
    clearTimeout(sliderUpdateDebounceTimeout);
    sliderUpdateDebounceTimeout = null;
  }
  if (dragEndTimeout) {
    clearTimeout(dragEndTimeout);
    dragEndTimeout = null;
  }
  isDragging.value = false;
  displayValue.value = pointerStartValue;
  handleGroupTap();
};

const onPointerCancel = () => {
  collapseControlsSoon();
  if (pointerStartX === null) return;
  resetPointerInteraction();
  if (sliderUpdateDebounceTimeout) {
    clearTimeout(sliderUpdateDebounceTimeout);
    sliderUpdateDebounceTimeout = null;
  }
  if (dragEndTimeout) {
    clearTimeout(dragEndTimeout);
    dragEndTimeout = null;
  }
  isDragging.value = false;
  displayValue.value = pointerStartValue;
};

const resetPointerInteraction = () => {
  pointerStartX = null;
  pointerMoved = false;
};

const onTouchCancel = () => {
  collapseControlsSoon();
  const wasDragging = isDrag.value;
  isDrag.value = false;
  isScrolling.value = false;
  touchMoveCount.value = 0;
  maxMovement.value = 0;
  isTouching.value = false;

  // a disabled slider tracks the drag only to tell it apart from a tap, so it
  // has no value to settle on
  if (wasDragging && !isSliderDisabled.value) {
    // The drag has already changed the volume audibly, so an interruption
    // settles where it left off rather than snapping back to the start.
    sendVolumeFinal(displayValue.value);
    stopDragging();
    return;
  }

  cancelLiveSend();
  displayValue.value = touchStartValue.value;
  isDragging.value = false;
  if (dragEndTimeout) {
    clearTimeout(dragEndTimeout);
    dragEndTimeout = null;
  }
};

// --- Mouse drag handlers (relative mode only) ---
//
// In absolute mode the Slider owns mouse input and onPointerDown/onSliderClick
// own the group tap, so every handler here bails out early. In relative mode
// the slider has pointer-events disabled, which also makes the pointer
// handlers inert (their targetsSlider check can never match).

const onMouseMove = (event: MouseEvent) => {
  if (!isMouseDragging.value) return;
  // A mouseup swallowed by a context menu or a window switch would otherwise
  // leave the drag latched, and with it the block on server volume updates.
  if (event.buttons === 0) {
    onMouseUp(event);
    return;
  }
  if (isSliderDisabled.value) return;

  const newValue = getValueFromDelta(
    mouseStartValue.value,
    event.clientX - mouseStartX.value,
  );

  displayValue.value = newValue;
};

const onMouseUp = (event: MouseEvent) => {
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", onMouseUp);

  if (!isMouseDragging.value) return;
  isMouseDragging.value = false;

  const deltaX = event.clientX - mouseStartX.value;

  if (Math.abs(deltaX) < MOUSE_DRAG_THRESHOLD_PX) {
    // Too little travel to be a drag, so treat it as a click and run the group
    // action instead of changing the volume. Guarded like onSliderClick: a tap
    // on a touchscreen also arrives here as a compatibility mouse event, after
    // touchend has already run the action.
    if (
      handlesGroupTap.value &&
      !isTouching.value &&
      Date.now() - lastPopoutToggleTime >= 500
    ) {
      handleGroupTap();
    }
  } else if (!isSliderDisabled.value) {
    const finalValue = getValueFromDelta(mouseStartValue.value, deltaX);
    displayValue.value = finalValue;
    setVolume(finalValue);
  }

  stopDragging();
};

const onMouseDown = (event: MouseEvent) => {
  if (!isRelativeMode.value) return;
  // only the primary button drags: a right click has its own context menu, and
  // latching on it would block server updates until the mouse moved again
  if (event.button !== 0) return;
  // a muted slider still answers a tap by opening the group's own controls,
  // which is how you get to a child slider to unmute it
  if (isSliderDisabled.value && !handlesGroupTap.value) return;
  // Leave the mute button and the volume readout to their own handlers
  if (
    (event.target as HTMLElement).closest(".volume-prepend, .volume-append")
  ) {
    return;
  }

  isMouseDragging.value = true;
  mouseStartX.value = event.clientX;
  mouseStartValue.value = displayValue.value;
  startDragging();
  // Suppress text selection while dragging
  event.preventDefault();

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
};

const onWheel = (event: WheelEvent) => {
  // Only claim the wheel when it changes volume, so sliders inside a scrollable
  // container (the group popout) still scroll it
  if (!props.allowWheel || isSliderDisabled.value) return;
  event.preventDefault();

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

  if (pointerStartX !== null && !pointerMoved) return;

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

// Desktop clicks use the same group action as touch taps.
const onSliderClick = () => {
  // In relative mode the mouseup handler owns this, so don't run it twice
  if (isRelativeMode.value) return;
  if (!handlesGroupTap.value || isTouching.value || isDragging.value) return;
  if (Date.now() - lastPopoutToggleTime < 500) return;
  handleGroupTap();
};

// a swapped-in player starts from the resting slider rather than inheriting
// the step buttons the previous one was left with
watch(() => props.player.player_id, collapseControls);

watch(showStepButtons, (shown) => {
  if (shown) {
    if (bubbleFrame === null) trackBubble();
  } else {
    stopTrackingBubble();
  }
});

// Sync server volume to display when not actively dragging
watch(
  currentVolume,
  (val: number) => {
    if (isDragging.value) return;

    if (Math.abs(displayValue.value - val) > 0.5) {
      displayValue.value = val;
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
  margin-left: 8px;
}

/* --- Touch expansion --- */

/* The step buttons are absolute so they cross-fade over the mute button and the
   level readout without ever taking width from the track: the slider keeps the
   same geometry expanded or not, so the thumb never jumps under the finger. */
.player-volume-container.expandable .volume-prepend,
.player-volume-container.expandable .volume-append {
  position: relative;
  align-self: stretch;
  transition: width 0.15s ease;
}

/* both slots widen by the same amount, so the track loses length evenly at each
   end and its midpoint - and with it the thumb - barely moves */
.player-volume-container.expanded .volume-prepend,
.player-volume-container.expanded .volume-append {
  width: 38px;
}

.volume-slot-item {
  transition: opacity 0.15s ease;
}

.volume-slot-item.is-hidden {
  opacity: 0;
  pointer-events: none;
}

.volume-step-btn {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: inherit;
  -webkit-tap-highlight-color: transparent;
}

/* they also reach outwards, into the margin the row already keeps clear, which
   buys the tap target width the track does not have to give up */
.volume-prepend .volume-step-btn {
  inset: 0 0 0 -8px;
}

.volume-append .volume-step-btn {
  inset: 0 -8px 0 0;
}

.volume-step-btn:active {
  opacity: 0.5;
}

/* the rail fattens in place: it stays well inside the row's height, so the bar
   around it keeps the height it rests at */
.player-volume-container.expandable :deep([data-slot="slider-track"]),
.player-volume-container.expandable :deep([data-slot="slider-track"])::before,
.player-volume-container.expandable :deep([data-slot="slider-thumb"])::before {
  transition:
    height 0.15s ease,
    width 0.15s ease;
}

.player-volume-container.expanded :deep([data-slot="slider-track"]),
.player-volume-container.expanded :deep([data-slot="slider-track"])::before {
  height: 12px !important;
}

.player-volume-container.expanded :deep([data-slot="slider-thumb"])::before {
  width: 18px !important;
  height: 18px !important;
}

/* --- Group volume popout styles are in the unscoped style block below --- */

/* On touch devices the container owns the gesture, so the slider itself must
   not swallow pointer events. Mouse input still reaches the slider, which in
   absolute mode keeps click-to-position and keyboard control working. */
@media (pointer: coarse) {
  .volume-slider,
  .volume-slider :deep(*) {
    pointer-events: none;
  }
}

/* Relative mode: the container owns pointer interaction on every device. */
.player-volume-container.relative-mode {
  cursor: ew-resize;
}

.player-volume-container.relative-mode .volume-slider,
.player-volume-container.relative-mode .volume-slider :deep(*) {
  pointer-events: none;
}
</style>

<!-- Unscoped styles for the teleported popout and volume readout -->
<style>
/* left is the thumb's centre, so the readout is shifted back over it */
.volume-bubble {
  position: fixed;
  transform: translateX(-50%);
  z-index: 10001;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), 0.12);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  /* it tracks the thumb the finger is already on, so it must never take a touch */
  pointer-events: none;
}

.volume-bubble-enter-active,
.volume-bubble-leave-active {
  transition: opacity 0.15s ease;
}

.volume-bubble-enter-from,
.volume-bubble-leave-to {
  opacity: 0;
}

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
  /* Max-height is set inline: the room above the slider, less POPOUT_MARGIN */
  overflow-y: auto;
  overscroll-behavior: contain;
  z-index: 10001;
}

/* touch-action is intersected from the touched row up to the scroll container,
   so the rows have to allow the vertical pan themselves; horizontal drags still
   reach onTouchMove, which claims them. A scrolling list outside this component
   opts in with .player-volume-scroller. The wrapper is named as well, to
   out-rank the scoped rule whichever of the two blocks loads last. */
.group-popout .player-volume-wrapper .player-volume-container,
.player-volume-scroller .player-volume-wrapper .player-volume-container {
  touch-action: pan-y;
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
  margin: 14px 0 10px 0;
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
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
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
