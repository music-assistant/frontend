<template>
  <div
    ref="sliderContainerRef"
    class="player-volume-container"
    :class="{ disabled: disabled, 'not-powered': !isPowered }"
    :style="{ width: width, ...(style ? parseStyle(style) : {}) }"
    @wheel.prevent="onWheel"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
    @touchcancel="onTouchCancel"
  >
    <div v-if="$slots.prepend || prependIcon" class="volume-prepend">
      <slot name="prepend">
        <button
          v-if="prependIconComponent"
          class="volume-icon-btn"
          @click.stop="onPrependClick"
        >
          <component :is="prependIconComponent" :size="20" />
        </button>
      </slot>
    </div>

    <Slider
      :model-value="[displayValue]"
      :disabled="disabled"
      :min="0"
      :max="100"
      :step="step"
      class="volume-slider"
      :class="cn('w-full', props.class)"
      @update:model-value="onSliderUpdate"
    />

    <div v-if="$slots.append || appendIcon" class="volume-append">
      <slot name="append">
        <button
          v-if="appendIconComponent"
          class="volume-icon-btn"
          @click.stop="onAppendClick"
        >
          <component :is="appendIconComponent" :size="20" />
        </button>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { store } from "@/plugins/store";
import { Minus, Plus } from "lucide-vue-next";
import type { Component } from "vue";
import { onUnmounted, ref, watch } from "vue";

export interface Props {
  modelValue?: number;
  disabled?: boolean;
  isPowered?: boolean;
  width?: string;
  step?: number;
  allowWheel?: boolean;
  color?: string;
  style?: string;
  class?: string;
  prependIcon?: string | Component;
  appendIcon?: string | Component;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: 0,
  disabled: false,
  isPowered: true,
  width: "100%",
  step: 2,
  allowWheel: false,
  color: "secondary",
  style: "",
  class: "",
  prependIcon: undefined,
  appendIcon: undefined,
});

const emit = defineEmits<{
  (e: "update:model-value", value: number): void;
  (e: "update:local-value", value: number): void;
  (e: "click:prepend"): void;
  (e: "click:append"): void;
}>();

const resolveIcon = (
  icon: string | Component | undefined,
): Component | undefined => {
  if (!icon) return undefined;
  if (typeof icon !== "string") return icon;
  if (icon === "mdi-volume-minus" || icon === "minus") return Minus;
  if (icon === "mdi-volume-plus" || icon === "plus") return Plus;
  return undefined;
};

const prependIconComponent = resolveIcon(props.prependIcon);
const appendIconComponent = resolveIcon(props.appendIcon);

// Refs
const sliderContainerRef = ref<HTMLElement | null>(null);
const displayValue = ref(props.modelValue);

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

const parseStyle = (styleStr: string): Record<string, string> => {
  const styles: Record<string, string> = {};
  styleStr.split(";").forEach((rule) => {
    const [key, value] = rule.split(":").map((s) => s.trim());
    if (key && value) {
      const camelKey = key.replace(/-([a-z])/g, (_, letter) =>
        letter.toUpperCase(),
      );
      styles[camelKey] = value;
    }
  });
  return styles;
};

const emitValue = (value: number, isFinal: boolean = false) => {
  if (props.disabled) return;

  const clampedValue = clamp(roundToStep(value), 0, 100);

  if (isFinal) {
    startBlocking();
  }

  displayValue.value = clampedValue;
  emit("update:local-value", clampedValue);

  if (isFinal) {
    emit("update:model-value", clampedValue);
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
  if (props.disabled) return;

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
  if (props.disabled || isScrolling.value) return;

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
  if (props.disabled) return;

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
  if (!props.allowWheel || props.disabled) return;

  const delta = event.deltaY < 0 ? props.step : -props.step;
  const newValue = clamp(displayValue.value + delta, 0, 100);

  startBlocking();
  emitValue(newValue, true);
};

const onSliderUpdate = (values: number[] | undefined) => {
  if (props.disabled || isScrolling.value || isTouching.value || !values)
    return;

  const newValue = values[0] ?? displayValue.value;
  displayValue.value = newValue;
  emit("update:local-value", newValue);

  if (sliderUpdateDebounceTimeout) {
    clearTimeout(sliderUpdateDebounceTimeout);
    sliderUpdateDebounceTimeout = null;
  }

  sliderUpdateDebounceTimeout = setTimeout(() => {
    emit("update:model-value", newValue);
    sliderUpdateDebounceTimeout = null;
  }, SLIDER_UPDATE_DEBOUNCE_MS);
};

const onPrependClick = () => {
  if (props.disabled) return;
  const newValue = clamp(displayValue.value - props.step, 0, 100);
  startBlocking();
  displayValue.value = newValue;
  emit("update:local-value", newValue);
  emit("update:model-value", newValue);
  emit("click:prepend");
};

const onAppendClick = () => {
  if (props.disabled) return;
  const newValue = clamp(displayValue.value + props.step, 0, 100);
  startBlocking();
  displayValue.value = newValue;
  emit("update:local-value", newValue);
  emit("update:model-value", newValue);
  emit("click:append");
};

watch(
  () => props.modelValue,
  (val: number | undefined) => {
    if (typeof val !== "number") return;

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

.player-volume-container.not-powered {
  opacity: 0.5;
}

.volume-prepend,
.volume-append {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  overflow: visible;
}

.volume-prepend {
  margin-right: 4px;
}

.volume-append {
  margin-left: 4px;
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

@media (pointer: coarse) {
  .volume-slider {
    pointer-events: none;
  }
}
</style>
