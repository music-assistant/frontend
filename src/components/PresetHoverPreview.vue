<!--
  Floating low-res live preview of a MilkDrop preset, shown beside a preset
  picker while hovering its entries (desktop only). Hosted by the settings
  page (synthetic waveform, no relay there) and the fullscreen player menu
  (live waveform via the `live` prop).

  One engine instance is created lazily and re-pointed on every hover:
  extra WebGL contexts risk Chrome evicting the oldest live one, which
  could be the running fullscreen visualizer.
-->
<template>
  <Teleport to="body">
    <div
      v-show="preset"
      class="fixed z-[10001] h-36 w-64 overflow-hidden rounded-md border bg-black shadow-md"
      :style="panelStyle"
    >
      <!-- isolate so the tint blends against the canvas alone, matching the
           main canvas's tint layer -->
      <div class="isolate relative size-full">
        <canvas ref="canvasEl" class="block size-full"></canvas>
        <div
          v-if="tintColor"
          class="absolute inset-0 mix-blend-color"
          :style="{ backgroundColor: tintColor }"
        ></div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import {
  currentVisualizerTint,
  liveVisualizerFrame,
} from "@/composables/visualizer/state";
import type { PreviewAnchor } from "@/composables/visualizer/usePresetHoverPreview";
import type { VisualizerEngine } from "@/composables/visualizer/useVisualizerEngine";
import { createVisualizerEngine } from "@/composables/visualizer/useVisualizerEngine";
import { createSyntheticFrameSource } from "@/helpers/visualizer/syntheticWaveform";

const props = defineProps<{
  preset: string | null;
  anchor: PreviewAnchor | null;
  // Pull the running visualizer's live waveform, falling back to the
  // synthetic one while no live frames arrive (paused, no relay).
  live?: boolean;
}>();

const PANEL_WIDTH = 256;
const PANEL_HEIGHT = 144;
const GAP = 8;
// With no track to tint from (settings page), the Open Home Foundation
// blue (from assets/open-home-foundation-logo.svg) stands in.
const SYNTHETIC_TINT = "#18bcf2";

const tintColor = computed(() =>
  props.live ? currentVisualizerTint.value : SYNTHETIC_TINT,
);

const canvasEl = ref<HTMLCanvasElement | null>(null);
const syntheticSource = createSyntheticFrameSource();
const frameSource = props.live
  ? () => liveVisualizerFrame() ?? syntheticSource()
  : syntheticSource;
let engine: VisualizerEngine | null = null;
let engineCreating: Promise<VisualizerEngine | null> | null = null;

const panelStyle = computed(() => {
  if (!props.anchor) return {};
  const { item, list } = props.anchor;
  // Right of the dropdown, flipped to the left when the viewport runs out.
  let left = list.right + GAP;
  if (left + PANEL_WIDTH > window.innerWidth - GAP) {
    left = list.left - GAP - PANEL_WIDTH;
  }
  left = Math.max(GAP, left);
  const top = Math.max(
    GAP,
    Math.min(item.top, window.innerHeight - PANEL_HEIGHT - GAP),
  );
  return { left: `${left}px`, top: `${top}px` };
});

const ensureEngine = async (): Promise<VisualizerEngine | null> => {
  engineCreating ??= createVisualizerEngine(
    canvasEl.value!,
    frameSource,
    "low",
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
    // The panel just became visible; the canvas needs layout before the
    // engine reads its size.
    await nextTick();
    const eng = await ensureEngine();
    // The hover may have moved on (or away) while the engine loaded.
    if (!eng || props.preset !== name) return;
    eng.setPaused(false, false);
    await eng.loadPresetByName(name, 0);
  },
);

onBeforeUnmount(() => {
  engine?.destroy();
  engine = null;
});
</script>
