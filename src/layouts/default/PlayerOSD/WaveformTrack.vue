<template>
  <div ref="containerEl" class="waveform-track">
    <canvas ref="dimCanvasEl" class="waveform-canvas" />
    <canvas
      ref="hoverCanvasEl"
      class="waveform-canvas"
      :style="{ clipPath: hoverClipPath }"
    />
    <canvas
      ref="progressCanvasEl"
      class="waveform-canvas"
      :style="{ clipPath: progressClipPath }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
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
const dimCanvasEl = ref<HTMLCanvasElement>();
const hoverCanvasEl = ref<HTMLCanvasElement>();
const progressCanvasEl = ref<HTMLCanvasElement>();

const { width, height } = useElementSize(containerEl);

const clampedProgress = computed(() =>
  Math.min(100, Math.max(0, props.progressPercent)),
);

const clampedHover = computed(() =>
  Math.min(100, Math.max(0, props.hoverPercent ?? 0)),
);

// Progress canvas clip: when hovering before progress, exclude 0→hover so the
// hover canvas can show a mid-brightness indicator in that region.
const progressClipPath = computed(() => {
  const p = clampedProgress.value;
  if (props.hoverPercent == null || clampedHover.value >= p) {
    return `inset(0 ${100 - p}% 0 0)`;
  }
  // Hover is before progress: clip progress canvas to hover→progress only.
  return `inset(0 ${100 - p}% 0 ${clampedHover.value}%)`;
});

// Hover canvas clip: shows the seek-preview region at mid-brightness.
// Forward seek: progress→hover; backward seek: 0→hover.
const hoverClipPath = computed(() => {
  if (props.hoverPercent == null) return "inset(0 100% 0 0)";
  const h = clampedHover.value;
  const p = clampedProgress.value;
  if (h >= p) {
    return `inset(0 ${100 - h}% 0 ${p}%)`;
  }
  return `inset(0 ${100 - h}% 0 0)`;
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

const drawBars = (
  canvas: HTMLCanvasElement,
  peaks: number[],
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  color: string,
  alpha: number,
) => {
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  for (let i = 0; i < peaks.length; i++) {
    const barHeight = Math.max(MIN_BAR_HEIGHT, peaks[i] * cssHeight);
    const x = i * BAR_PITCH;
    const y = (cssHeight - barHeight) / 2;
    ctx.beginPath();
    if (typeof (ctx as CanvasRenderingContext2D).roundRect === "function") {
      ctx.roundRect(x, y, BAR_WIDTH, barHeight, BAR_WIDTH / 2);
    } else {
      ctx.rect(x, y, BAR_WIDTH, barHeight);
    }
    ctx.fill();
  }
};

const draw = () => {
  const cssWidth = width.value;
  const cssHeight = height.value;
  if (
    !dimCanvasEl.value ||
    !hoverCanvasEl.value ||
    !progressCanvasEl.value ||
    !props.data.length ||
    cssWidth <= 0 ||
    cssHeight <= 0
  )
    return;

  const dpr = window.devicePixelRatio || 1;
  const barCount = Math.ceil(cssWidth / BAR_PITCH);
  const peaks = computePeaks(props.data, barCount);

  drawBars(
    dimCanvasEl.value,
    peaks,
    cssWidth,
    cssHeight,
    dpr,
    props.color,
    DIM_ALPHA,
  );
  drawBars(
    hoverCanvasEl.value,
    peaks,
    cssWidth,
    cssHeight,
    dpr,
    props.color,
    HOVER_ALPHA,
  );
  drawBars(
    progressCanvasEl.value,
    peaks,
    cssWidth,
    cssHeight,
    dpr,
    props.color,
    1,
  );
};

// Progress/hover only move clip-paths, so playback and pointer movement never redraw.
watch([width, height, () => props.data, () => props.color], draw, {
  flush: "post",
});
</script>

<style scoped>
.waveform-track {
  position: relative;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.waveform-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
