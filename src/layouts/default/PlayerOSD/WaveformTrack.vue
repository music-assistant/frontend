<template>
  <div ref="containerEl" class="waveform-track">
    <canvas ref="dimCanvasEl" class="waveform-canvas" />
    <canvas
      ref="brightCanvasEl"
      class="waveform-canvas"
      :style="{ clipPath: `inset(0 ${100 - clampedProgress}% 0 0)` }"
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
}

const props = defineProps<Props>();

// 2px bar + 1px gap
const BAR_PITCH = 3;
const BAR_WIDTH = 2;
// Keep silent sections visible as a thin baseline.
const MIN_BAR_HEIGHT = 2;
const DIM_ALPHA = 0.3;

const containerEl = ref<HTMLDivElement>();
const dimCanvasEl = ref<HTMLCanvasElement>();
const brightCanvasEl = ref<HTMLCanvasElement>();

const { width, height } = useElementSize(containerEl);

const clampedProgress = computed(() =>
  Math.min(100, Math.max(0, props.progressPercent)),
);

// Max-pool the source bins into one peak per visible bar; max (not average)
// preserves the visual transients that make the waveform recognizable.
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
  alpha: number,
) => {
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.fillStyle = props.color;
  ctx.globalAlpha = alpha;
  for (let i = 0; i < peaks.length; i++) {
    const barHeight = Math.max(MIN_BAR_HEIGHT, peaks[i] * cssHeight);
    const x = i * BAR_PITCH;
    const y = (cssHeight - barHeight) / 2;
    ctx.beginPath();
    ctx.roundRect(x, y, BAR_WIDTH, barHeight, BAR_WIDTH / 2);
    ctx.fill();
  }
};

const draw = () => {
  const cssWidth = width.value;
  const cssHeight = height.value;
  if (
    !dimCanvasEl.value ||
    !brightCanvasEl.value ||
    !props.data.length ||
    cssWidth <= 0 ||
    cssHeight <= 0
  )
    return;

  const dpr = window.devicePixelRatio || 1;
  const barCount = Math.ceil(cssWidth / BAR_PITCH);
  const peaks = computePeaks(props.data, barCount);

  drawBars(dimCanvasEl.value, peaks, cssWidth, cssHeight, dpr, DIM_ALPHA);
  drawBars(brightCanvasEl.value, peaks, cssWidth, cssHeight, dpr, 1);
};

// Progress is intentionally excluded: it only moves the bright canvas'
// clip-path, so playback never triggers a canvas redraw.
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
