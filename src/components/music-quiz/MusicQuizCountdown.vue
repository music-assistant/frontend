<template>
  <div
    class="relative inline-grid place-items-center"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="timer"
    :aria-label="label"
  >
    <svg
      class="-rotate-90"
      :width="size"
      :height="size"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <circle
        class="stroke-muted"
        fill="none"
        cx="50"
        cy="50"
        :r="RADIUS"
        :stroke-width="STROKE_WIDTH"
      />
      <circle
        class="transition-[stroke-dashoffset] duration-200 ease-linear motion-reduce:transition-none"
        :class="isUrgent ? 'stroke-destructive' : 'stroke-primary'"
        fill="none"
        stroke-linecap="round"
        cx="50"
        cy="50"
        :r="RADIUS"
        :stroke-width="STROKE_WIDTH"
        :stroke-dasharray="CIRCUMFERENCE"
        :stroke-dashoffset="dashOffset"
      />
    </svg>
    <span
      class="absolute font-extrabold tabular-nums"
      :class="isUrgent ? 'text-destructive' : 'text-foreground'"
      :style="{ fontSize: `${Math.round(size * 0.26)}px` }"
    >
      {{ label }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const RADIUS = 45;
const STROKE_WIDTH = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const URGENT_THRESHOLD = 0.25;

const props = withDefaults(
  defineProps<{
    label: string;
    fraction: number | null;
    size?: number;
  }>(),
  { size: 120 },
);

const clampedFraction = computed(() =>
  Math.min(1, Math.max(0, props.fraction ?? 0)),
);
const dashOffset = computed(() => CIRCUMFERENCE * (1 - clampedFraction.value));
const isUrgent = computed(
  () => props.fraction !== null && props.fraction <= URGENT_THRESHOLD,
);
</script>
