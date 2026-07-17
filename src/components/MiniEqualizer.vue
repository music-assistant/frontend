<template>
  <canvas
    v-if="waveformBins"
    ref="canvasEl"
    class="mini-eq"
    aria-hidden="true"
    role="presentation"
  />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useActiveTrackWaveform } from "@/composables/useActiveTrackWaveform";
import { store } from "@/plugins/store";
import api from "@/plugins/api";

export interface Props {
  color?: string;
  // Number of bars to show in the scrolling window.
  bars?: number;
  // Height of the component in CSS pixels.
  height?: number;
}

const props = withDefaults(defineProps<Props>(), {
  color: "currentColor",
  bars: 20,
  height: 24,
});

const { waveformBins, trackDurationSecs } = useActiveTrackWaveform();
const canvasEl = ref<HTMLCanvasElement>();
let timerId: ReturnType<typeof setInterval> | null = null;

function getElapsedSecs(): number {
  const queueId = store.activePlayerQueue?.queue_id;
  const queueTime = queueId ? api.queueElapsedTime[queueId] : undefined;
  if (
    queueTime?.elapsed_time != null &&
    queueTime?.elapsed_time_last_updated != null
  ) {
    const isPlaying = store.activePlayerQueue?.state === "playing";
    const delta = isPlaying
      ? Date.now() / 1000 - queueTime.elapsed_time_last_updated
      : 0;
    return queueTime.elapsed_time + delta;
  }
  const player = store.activePlayer;
  if (
    player?.elapsed_time != null &&
    player?.elapsed_time_last_updated != null
  ) {
    const isPlaying = player.playback_state === "playing";
    const delta = isPlaying
      ? Date.now() / 1000 - player.elapsed_time_last_updated
      : 0;
    return player.elapsed_time + delta;
  }
  return 0;
}

function resolveColor(color: string): string {
  // Canvas fillStyle cannot resolve CSS variables — extract and resolve them.
  const match = color.match(/var\(\s*(--[^)]+)\s*\)/);
  if (match) {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(match[1])
      .trim();
    // Vuetify exposes theme colors as bare "R, G, B" strings.
    return value.includes(",") ? `rgb(${value})` : value || "#fff";
  }
  return color;
}

function draw() {
  const canvas = canvasEl.value;
  const bins = waveformBins.value;
  if (!canvas || !bins) return;

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = props.height;
  const targetW = Math.round(cssW * dpr);
  const targetH = Math.round(cssH * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const duration = trackDurationSecs.value;
  if (!duration) return;

  const elapsed = getElapsedSecs();
  const progress = Math.min(1, Math.max(0, elapsed / duration));
  const centerBin = Math.floor(progress * (bins.length - 1));

  const n = props.bars;
  const half = Math.floor(n / 2);
  const barW = 3;
  const gap = 2;
  const pitch = barW + gap;
  const totalW = n * pitch - gap;
  const startX = (cssW - totalW) / 2;

  ctx.fillStyle = resolveColor(props.color);

  for (let i = 0; i < n; i++) {
    const binIdx = Math.max(0, Math.min(bins.length - 1, centerBin - half + i));
    const rms = bins[binIdx];
    const barH = Math.max(cssH * 0.25, rms * cssH);
    const x = startX + i * pitch;
    const y = (cssH - barH) / 2;
    const isCurrent = i === half;
    const falloff = half > 0 ? 1 - Math.abs(i - half) / half : 1;
    ctx.globalAlpha = isCurrent ? 1 : 0.3 + 0.7 * falloff * rms;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, barW, barH, 1);
    } else {
      ctx.rect(x, y, barW, barH);
    }
    ctx.fill();
  }
}

function startTimer() {
  if (timerId !== null) return;
  timerId = setInterval(draw, 100);
}

function stopTimer() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function syncTimer() {
  if (store.activePlayerQueue?.state === "playing" && waveformBins.value) {
    startTimer();
  } else {
    stopTimer();
  }
}

onMounted(() => {
  draw();
});

onUnmounted(stopTimer);

watch(
  () => store.activePlayerQueue?.state,
  (state) => {
    syncTimer();
    if (state !== "playing") draw();
  },
  { immediate: true },
);

watch(waveformBins, () => {
  syncTimer();
  draw();
});
</script>

<style scoped>
.mini-eq {
  display: block;
  width: v-bind("`${props.bars * (3 + 2) - 2}px`");
  height: v-bind("`${props.height}px`");
}
</style>
