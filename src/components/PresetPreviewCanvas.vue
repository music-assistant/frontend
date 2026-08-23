<!--
  MilkDrop preset preview: one engine re-pointed per preset change (extra
  WebGL contexts risk Chrome evicting the running fullscreen visualizer),
  fed by a synthetic waveform and tinted OHF blue.
-->
<template>
  <!-- isolate so the tint blends against the canvas alone -->
  <div class="isolate relative size-full bg-black">
    <canvas ref="canvasEl" class="block size-full"></canvas>
    <div
      class="absolute inset-0 mix-blend-color"
      :style="{ backgroundColor: SYNTHETIC_TINT }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { VisualizerEngine } from "@/composables/visualizer/useVisualizerEngine";
import { createVisualizerEngine } from "@/composables/visualizer/useVisualizerEngine";
import { createSyntheticFrameSource } from "@/helpers/visualizer/syntheticWaveform";

const props = defineProps<{
  preset: string | null;
}>();

// From assets/open-home-foundation-logo.svg.
const SYNTHETIC_TINT = "#18bcf2";

const canvasEl = ref<HTMLCanvasElement | null>(null);
const frameSource = createSyntheticFrameSource();
let engine: VisualizerEngine | null = null;
let engineCreating: Promise<VisualizerEngine | null> | null = null;

const ensureEngine = async (): Promise<VisualizerEngine | null> => {
  if (!canvasEl.value) return null;
  engineCreating ??= createVisualizerEngine(
    canvasEl.value,
    frameSource,
    "native",
  );
  engine = await engineCreating;
  return engine;
};

watch(
  () => props.preset,
  async (name) => {
    if (!name) {
      engine?.setPaused(true, false);
      return;
    }
    // The canvas needs layout before the engine reads its size.
    await nextTick();
    const eng = await ensureEngine();
    if (!eng || props.preset !== name) return;
    eng.setPaused(false, false);
    await eng.loadPresetByName(name, 0);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  engine?.destroy();
  engine = null;
});
</script>
