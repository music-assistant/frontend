<template>
  <div
    ref="trackRef"
    class="progress-bar-track"
    :class="{ 'progress-bar-track--disabled': disabled }"
    role="slider"
    aria-orientation="horizontal"
    :aria-label="label"
    :aria-labelledby="labelledBy"
    :aria-valuenow="Math.round(modelValue)"
    :aria-valuemin="min"
    :aria-valuemax="Math.round(max)"
    :aria-valuetext="valueText"
    :aria-disabled="disabled"
    tabindex="0"
    @mouseenter="isThumbHidden = false"
    @mouseleave="isThumbHidden = true"
    @touchstart.passive="onPointerDown"
    @mousedown="onPointerDown"
    @keydown="onKeyDown"
  >
    <!-- background track -->
    <div class="progress-bar-rail"></div>

    <!-- filled portion: GPU-composited via scaleX -->
    <div class="progress-bar-fill-wrapper">
      <div
        class="progress-bar-fill"
        :style="{ transform: `scaleX(${progress})` }"
      ></div>
    </div>

    <!-- tick marks -->
    <template v-if="ticks && Object.keys(ticks).length">
      <div
        v-for="(label, pos) in ticks"
        :key="pos"
        class="progress-bar-tick"
        :style="{ left: `${(Number(pos) / max) * 100}%` }"
        @click.stop="emit('tick-click', Number(pos))"
      >
        <span
          v-if="showTickLabels && !isThumbHidden && tickCount < 6"
          class="progress-bar-tick-label text-caption"
        >
          {{ label }}
        </span>
      </div>
    </template>

    <!-- thumb -->
    <div
      class="progress-bar-thumb"
      :class="{ 'progress-bar-thumb--hidden': isThumbHidden }"
      :style="{ left: `${progress * 100}%` }"
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
  /** Step size for arrow-key nudges (default: 1% of range) */
  keyStep?: number;
  /** Step size for shift+arrow / page keys (default: 10% of range) */
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
  color: undefined,
  ticks: undefined,
  showTickLabels: false,
  keyStep: undefined,
  keyStepLarge: undefined,
  label: undefined,
  labelledBy: undefined,
  valueText: undefined,
});

const emit = defineEmits<{
  "update:modelValue": [value: number];
  "seek-start": [value: number];
  "seek-end": [value: number];
  "tick-click": [position: number];
}>();

const trackRef = ref<HTMLElement | null>(null);
const isThumbHidden = ref(true);

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

// ── Pointer drag ──────────────────────────────────────────────────────────────

const onPointerDown = (e: MouseEvent | TouchEvent) => {
  if (props.disabled) return;
  isThumbHidden.value = false;

  const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
  const startValue = positionFromClientX(clientX);
  emit("seek-start", startValue);
  emit("update:modelValue", startValue);

  const onMove = (ev: MouseEvent | TouchEvent) => {
    const x = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
    emit("update:modelValue", positionFromClientX(x));
  };

  const onUp = () => {
    isThumbHidden.value = true;
    emit("seek-end", props.modelValue);
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onUp);
  };

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
  document.addEventListener("touchmove", onMove, { passive: true });
  document.addEventListener("touchend", onUp);
};

// ── Keyboard ──────────────────────────────────────────────────────────────────

const onKeyDown = (e: KeyboardEvent) => {
  if (props.disabled) return;

  const smallStep = props.keyStep ?? range.value * 0.01;
  const largeStep = props.keyStepLarge ?? range.value * 0.1;

  let next = props.modelValue;
  if (e.key === "ArrowRight") next += e.shiftKey ? largeStep : smallStep;
  else if (e.key === "ArrowLeft") next -= e.shiftKey ? largeStep : smallStep;
  else if (e.key === "PageUp") next += largeStep;
  else if (e.key === "PageDown") next -= largeStep;
  else if (e.key === "Home") next = props.min;
  else if (e.key === "End") next = props.max;
  else return;

  e.preventDefault();
  const clamped = clamp(next);
  emit("seek-start", clamped);
  emit("update:modelValue", clamped);
  emit("seek-end", clamped);
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
  --progress-bar-color: currentColor;
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
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar-fill {
  width: 100%;
  height: 100%;
  transform-origin: left center;
  will-change: transform;
  background-color: rgb(var(--v-theme-surface-variant));
}

.progress-bar-thumb {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-left: -5px;
  background-color: rgb(var(--v-theme-surface-variant));
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  transition: opacity 0.15s ease;
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
