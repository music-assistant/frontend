<template>
  <div
    ref="trackRef"
    class="progress-bar-track"
    :class="{ 'progress-bar-track--disabled': disabled }"
    :style="colorStyle"
    role="slider"
    :aria-label="label"
    :aria-labelledby="labelledBy"
    :aria-valuenow="Math.round(modelValue)"
    :aria-valuemin="min"
    :aria-valuemax="Math.round(max)"
    :aria-valuetext="valueText"
    :aria-disabled="disabled"
    :tabindex="disabled ? -1 : 0"
    @mouseenter="isThumbHidden = false"
    @mouseleave="isThumbHidden = true"
    @focus="isThumbHidden = false"
    @blur="isThumbHidden = true"
    @touchstart.prevent="onPointerDown"
    @mousedown="onPointerDown"
    @keydown="onKeyDown"
  >
    <div class="progress-bar-rail"></div>

    <div class="progress-bar-fill-wrapper">
      <div
        class="progress-bar-fill"
        :class="{ 'progress-bar-fill--animated': !isDragging }"
        :style="{ transform: `translateX(${(progress - 1) * 100}%)` }"
      ></div>
    </div>

    <template v-if="ticks && Object.keys(ticks).length">
      <div
        v-for="(tickLabel, pos) in ticks"
        :key="pos"
        class="progress-bar-tick"
        :style="{ left: `${(Number(pos) / max) * 100}%` }"
        @click.stop="emit('tick-click', Number(pos))"
      >
        <span
          v-if="showTickLabels && !isThumbHidden && tickCount < 6"
          class="progress-bar-tick-label text-caption"
        >
          {{ tickLabel }}
        </span>
      </div>
    </template>

    <div
      class="progress-bar-thumb"
      :class="{
        'progress-bar-thumb--hidden': isThumbHidden,
        'progress-bar-thumb--animated': !isDragging,
      }"
      :style="{ transform: `translateX(${progress * 100}cqw)` }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

export interface ProgressBarTicks {
  [position: number]: string;
}

export interface Props {
  color?: string;
  disabled?: boolean;
  keyStep?: number;
  keyStepLarge?: number;
  label?: string;
  labelledBy?: string;
  max?: number;
  min?: number;
  modelValue: number;
  showTickLabels?: boolean;
  ticks?: ProgressBarTicks;
  valueText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 100,
  disabled: false,
  showTickLabels: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: number];
  "seek-start": [value: number];
  "seek-end": [value: number, source: "keyboard" | "pointer"];
  "tick-click": [position: number];
}>();

const trackRef = ref<HTMLElement | null>(null);
const isThumbHidden = ref(true);
const isDragging = ref(false);

const range = computed(() => props.max - props.min);
const progress = computed(() =>
  Math.min(Math.max((props.modelValue - props.min) / range.value, 0), 1),
);
const tickCount = computed(() =>
  props.ticks ? Object.keys(props.ticks).length : 0,
);
const colorStyle = computed(() =>
  props.color ? { "--progress-bar-color": props.color } : undefined,
);

const positionFromClientX = (clientX: number): number => {
  if (!trackRef.value) return props.modelValue;
  const rect = trackRef.value.getBoundingClientRect();
  const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  return props.min + ratio * range.value;
};

const clamp = (v: number) => Math.min(Math.max(v, props.min), props.max);

const onPointerDown = (e: MouseEvent | TouchEvent) => {
  if (props.disabled) return;
  // Ensure track receives focus for subsequent keyboard input
  trackRef.value?.focus();

  isThumbHidden.value = false;
  isDragging.value = true;

  const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
  const startValue = positionFromClientX(clientX);
  emit("seek-start", startValue);
  emit("update:modelValue", startValue);

  const onMove = (ev: MouseEvent | TouchEvent) => {
    if ("touches" in ev) ev.preventDefault();
    const x = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
    emit("update:modelValue", positionFromClientX(x));
  };

  const onUp = () => {
    isDragging.value = false;
    if (document.activeElement !== trackRef.value) {
      isThumbHidden.value = true;
    }
    emit("seek-end", props.modelValue, "pointer");
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onUp);
  };

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
  document.addEventListener("touchmove", onMove, { passive: false });
  document.addEventListener("touchend", onUp);
};

const onKeyDown = (e: KeyboardEvent) => {
  if (props.disabled) return;

  const smallStep = props.keyStep ?? range.value * 0.01;
  const largeStep = props.keyStepLarge ?? range.value * 0.1;

  let next = props.modelValue;
  switch (e.key) {
    case "ArrowRight":
    case "ArrowUp":
      next += e.shiftKey ? largeStep : smallStep;
      break;
    case "ArrowLeft":
    case "ArrowDown":
      next -= e.shiftKey ? largeStep : smallStep;
      break;
    case "PageUp":
      next += largeStep;
      break;
    case "PageDown":
      next -= largeStep;
      break;
    case "Home":
      next = props.min;
      break;
    case "End":
      next = props.max;
      break;
    default:
      return;
  }

  e.preventDefault();
  const clamped = clamp(next);
  emit("seek-start", clamped);
  emit("update:modelValue", clamped);
  emit("seek-end", clamped, "keyboard");
};
</script>

<style scoped>
.progress-bar-track {
  position: relative;
  height: 24px;
  display: flex;
  align-items: center;
  cursor: pointer;
  touch-action: none;
  user-select: none;
  container-type: inline-size;
  --progress-bar-color: rgb(var(--v-theme-surface-variant));
}

.progress-bar-track:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 4px;
  border-radius: 2px;
}

.progress-bar-track--disabled {
  cursor: default;
  opacity: 0.5;
}

.progress-bar-rail {
  position: absolute;
  left: 0;
  right: 0;
  height: 4px;
  border-radius: 9999px;
  background: rgba(var(--v-theme-on-surface), 0.24);
}

.progress-bar-fill-wrapper {
  position: absolute;
  left: 0;
  right: 0;
  height: 6px;
  border-radius: 9999px;
  overflow: hidden;
}

.progress-bar-fill {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background-color: var(--progress-bar-color);
  will-change: transform;
}

.progress-bar-fill--animated {
  transition: transform 120ms linear;
}

.progress-bar-thumb {
  position: absolute;
  left: 0;
  top: 50%;
  width: 10px;
  height: 10px;
  margin-top: -5px;
  margin-left: -5px;
  border-radius: 50%;
  background-color: var(--progress-bar-color);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  will-change: transform;
  opacity: 1;
  transition: opacity 0.15s ease;
}

.progress-bar-thumb--animated {
  transition:
    opacity 0.15s ease,
    transform 120ms linear;
}

.progress-bar-thumb--hidden {
  opacity: 0;
}

.progress-bar-tick {
  position: absolute;
  top: 50%;
  width: 2px;
  height: 4px;
  margin-top: -2px;
  margin-left: -1px;
  background: rgba(var(--v-theme-on-surface), 0.5);
  cursor: pointer;
}

.progress-bar-tick-label {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
}
</style>
