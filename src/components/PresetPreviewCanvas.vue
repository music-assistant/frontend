<!--
  MilkDrop preset preview: one engine re-pointed per preset change (extra
  WebGL contexts risk Chrome evicting the running fullscreen visualizer), fed
  by a synthetic waveform and recoloured from a synthetic blue palette through
  the user's own palette settings. The engine is released while the
  fullscreen player covers the page.
-->
<template>
  <div class="relative size-full bg-black">
    <canvas ref="canvasEl" class="block size-full"></canvas>
    <p
      v-if="unavailable"
      class="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted-foreground"
    >
      {{ $t("visualizer.preview_unavailable") }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import {
  createVisualizerEngine,
  type VisualizerEngine,
} from "@/composables/visualizer/useVisualizerEngine";
import { useVisualizerPalette } from "@/composables/visualizer/useVisualizerPalette";
import { SYNTHETIC_PALETTE } from "@/helpers/visualizer/syntheticPalette";
import { createSyntheticFrameSource } from "@/helpers/visualizer/syntheticWaveform";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";

const props = defineProps<{
  preset: string | null;
}>();

const canvasEl = ref<HTMLCanvasElement | null>(null);
const unavailable = ref(false);
const frameSource = createSyntheticFrameSource();
let engine: VisualizerEngine | null = null;
let engineCreating: Promise<VisualizerEngine | null> | null = null;
let unmounted = false;

// Release the GPU while the fullscreen player covers the page, as the
// visualizer canvas does.
const covered = computed(() => store.showFullscreenPlayer);

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

const releaseEngine = () => {
  engine?.destroy();
  engine = null;
  engineCreating = null;
};

const ensureEngine = async (): Promise<VisualizerEngine | null> => {
  if (!canvasEl.value) return null;
  engineCreating ??= createVisualizerEngine(canvasEl.value, frameSource).catch(
    (error: unknown) => {
      console.error("[visualizer] preview engine init failed:", error);
      return null;
    },
  );
  const creating = engineCreating;
  const created = await creating;
  // Unmounted or covered mid-create: tear down, or the render loop outlives
  // its owner.
  if (unmounted || creating !== engineCreating) {
    created?.destroy();
    return null;
  }
  // A failed start must not stick: the next preset change retries.
  if (!created) engineCreating = null;
  unavailable.value = !created;
  engine = created;
  applyPalette();
  return engine;
};

watch(
  [() => props.preset, covered],
  async ([name, isCovered]) => {
    if (isCovered) {
      releaseEngine();
      return;
    }
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
  releaseEngine();
});
</script>
