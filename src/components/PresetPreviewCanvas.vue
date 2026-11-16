<!--
  MilkDrop preset preview: one engine re-pointed per preset change (extra
  WebGL contexts risk Chrome evicting the running fullscreen visualizer), fed
  by a synthetic waveform and recoloured from a synthetic blue palette through
  the user's own palette settings.
-->
<template>
  <canvas ref="canvasEl" class="block size-full bg-black"></canvas>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import {
  createVisualizerEngine,
  type VisualizerEngine,
} from "@/composables/visualizer/useVisualizerEngine";
import { useVisualizerPalette } from "@/composables/visualizer/useVisualizerPalette";
import { SYNTHETIC_PALETTE } from "@/helpers/visualizer/syntheticPalette";
import { createSyntheticFrameSource } from "@/helpers/visualizer/syntheticWaveform";

const props = defineProps<{
  preset: string | null;
}>();

const canvasEl = ref<HTMLCanvasElement | null>(null);
const frameSource = createSyntheticFrameSource();
let engine: VisualizerEngine | null = null;
let engineCreating: Promise<VisualizerEngine | null> | null = null;
let unmounted = false;

// The preview sits on black whatever the app theme.
const { paletteColors, paletteRamp, paletteRampStrength } =
  useVisualizerPalette({
    palette: ref(SYNTHETIC_PALETTE),
    forceDark: true,
  });

const applyPalette = () => {
  engine?.setPaletteColors(paletteColors.value);
  engine?.setPaletteRamp(paletteRamp.value, paletteRampStrength.value);
};

watch([paletteColors, paletteRamp, paletteRampStrength], applyPalette);

const ensureEngine = async (): Promise<VisualizerEngine | null> => {
  if (!canvasEl.value) return null;
  engineCreating ??= createVisualizerEngine(canvasEl.value, frameSource);
  const created = await engineCreating;
  // Unmounted mid-create: tear down, or the render loop outlives the canvas.
  if (unmounted) {
    created?.destroy();
    return null;
  }
  engine = created;
  applyPalette();
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
  unmounted = true;
  engine?.destroy();
  engine = null;
});
</script>
