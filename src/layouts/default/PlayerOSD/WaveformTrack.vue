<template>
  <div ref="containerEl" class="waveform-track">
    <svg class="waveform-layer" aria-hidden="true">
      <path
        :d="barsPath"
        :stroke="color"
        :stroke-opacity="DIM_ALPHA"
        :stroke-width="BAR_WIDTH"
        stroke-linecap="round"
        fill="none"
      />
    </svg>
    <svg
      class="waveform-layer"
      aria-hidden="true"
      :style="{ clipPath: hoverClipPath }"
    >
      <path
        :d="barsPath"
        :stroke="color"
        :stroke-opacity="HOVER_ALPHA"
        :stroke-width="BAR_WIDTH"
        stroke-linecap="round"
        fill="none"
      />
    </svg>
    <svg
      class="waveform-layer"
      aria-hidden="true"
      :style="{ clipPath: progressClipPath }"
    >
      <path
        :d="barsPath"
        :stroke="color"
        :stroke-width="BAR_WIDTH"
        stroke-linecap="round"
        fill="none"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useElementSize } from "@vueuse/core";

export interface Props {
  // Normalized (0.0-1.0) RMS energy bins covering the full track duration.
  data: number[];
  color: string;
  // Played portion of the track, 0-100.
  progressPercent: number;
  // Hovered seek-preview position, 0-100; null when not hovering.
  hoverPercent?: number | null;
}

const props = withDefaults(defineProps<Props>(), {
  hoverPercent: null,
});

// 2px bar + 1px gap
const BAR_PITCH = 3;
const BAR_WIDTH = 2;
// Keep silent sections visible as a thin baseline.
const MIN_BAR_HEIGHT = 2;
const DIM_ALPHA = 0.3;
const HOVER_ALPHA = 0.5;

const containerEl = ref<HTMLDivElement>();

const { width, height } = useElementSize(containerEl);

const clampedProgress = computed(() =>
  Math.min(100, Math.max(0, props.progressPercent)),
);

const clampedHover = computed(() =>
  Math.min(100, Math.max(0, props.hoverPercent ?? 0)),
);

const progressClipPath = computed(() => {
  const p = clampedProgress.value;
  const h = clampedHover.value;
  if (props.hoverPercent == null || h >= p) {
    return `inset(0 ${100 - p}% 0 0)`;
  }
  return `inset(0 ${100 - h}% 0 0)`;
});

const hoverClipPath = computed(() => {
  if (props.hoverPercent == null) return "inset(0 100% 0 0)";
  const h = clampedHover.value;
  const p = clampedProgress.value;
  if (h >= p) {
    return `inset(0 ${100 - h}% 0 ${p}%)`;
  }
  return `inset(0 ${100 - p}% 0 ${h}%)`;
});

// Max-pool bins into one peak per bar; max (not average) preserves the transients.
const computePeaks = (bins: number[], barCount: number): number[] => {
  const peaks = Array.from({ length: barCount }, () => 0);
  for (let i = 0; i < barCount; i++) {
    const start = Math.floor((i * bins.length) / barCount);
    const end = Math.max(
      start + 1,
      Math.floor(((i + 1) * bins.length) / barCount),
    );
    let max = 0;
    for (let j = start; j < end; j++) {
      if (bins[j] > max) max = bins[j];
    }
    peaks[i] = max;
  }
  return peaks;
};

// One vertical segment per bar. Round caps supply the rounded ends, so a bar is
// inset by half the stroke on both sides and a silent bar collapses to a dot.
const barsPath = computed(() => {
  const cssWidth = width.value;
  const cssHeight = height.value;
  if (!props.data.length || cssWidth <= 0 || cssHeight <= 0) return "";

  const barCount = Math.ceil(cssWidth / BAR_PITCH);
  const peaks = computePeaks(props.data, barCount);
  const inset = BAR_WIDTH / 2;

  let path = "";
  for (let i = 0; i < barCount; i++) {
    const barHeight = Math.max(MIN_BAR_HEIGHT, peaks[i] * cssHeight);
    const x = (i * BAR_PITCH + inset).toFixed(2);
    const top = ((cssHeight - barHeight) / 2 + inset).toFixed(2);
    const bottom = (
      (cssHeight - barHeight) / 2 +
      Math.max(inset, barHeight - inset)
    ).toFixed(2);
    path += `M${x} ${top}V${bottom}`;
  }
  return path;
});
</script>

<style scoped>
.waveform-track {
  position: relative;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.waveform-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
</style>
