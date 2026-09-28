<!--
  MilkDrop (butterchurn) visualizer layer.

  Renders behind the view content (absolute, z-index 0, no pointer events),
  fed by MA core's visualizer relay. The engine recolors toward the track's
  artwork palette; a subtle scrim keeps overlaid text legible; the blur option
  previews the "ambient background" treatment. Renders nothing (transparent)
  while unsupported or disconnected, so the regular gradient background
  underneath stays visible. Pausing or stopping the player winds it down
  (waveform to silence, layer faded out) and suspends the render loop.

  Engine, relay and adaptive quality lifecycle lives in
  useVisualizerCanvasEngine; this file is presentation and preferences.
-->
<template>
  <div class="visualizer-layer" aria-hidden="true" :style="layerStyle">
    <div class="visualizer-layer__stack">
      <canvas
        ref="canvasRef"
        class="visualizer-layer__canvas"
        :style="canvasStyle"
      ></canvas>
    </div>
    <div
      v-if="streaming"
      class="visualizer-layer__scrim"
      :style="scrimStyle"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  ATTACK_MS,
  DECAY_MS,
} from "@/composables/visualizer/useVisualizerEngine";
import { visualizerPreference } from "@/composables/visualizer/useVisualizer";
import { useVisualizerCanvasEngine } from "@/composables/visualizer/useVisualizerCanvasEngine";
import { useVisualizerPalette } from "@/composables/visualizer/useVisualizerPalette";
import {
  currentVisualizerPreset,
  VISUALIZER_BLUR_DEFAULT,
  VISUALIZER_OPACITY_DEFAULT,
} from "@/composables/visualizer/state";
import { randomPresetName } from "@/helpers/visualizer/presetLibrary";
import { DEFAULT_QUALITY } from "@/helpers/visualizer/quality";
import api from "@/plugins/api";
import { PlaybackState } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";

// Settle time before winding down: track changes and buffer stalls drop a
// player out of "playing" for a moment, and halting on those reads as a stutter.
const PAUSE_SETTLE_MS = 1000;
// What the layer fades to while paused; raise it to leave the settled preset
// faintly visible.
const PAUSED_OPACITY = 0;

const props = withDefaults(
  defineProps<{
    // preset name; empty string = random pick
    preset?: string;
    // blur radius in px, 0 = off
    blur?: number;
    // visualizer opacity 0-100; below 100 the background gradient blends through
    opacity?: number;
    // MA player id whose group to visualize. Empty means the hosting view has
    // not resolved its player yet: no relay connection is made until it does.
    playerId?: string;
    // Suspend while another view covers this one (e.g. the fullscreen player
    // opened on top of a dashboard), so only one engine renders at a time.
    coveredWhenFullscreen?: boolean;
    // Which palette side to tint with; the host view knows whether it forces
    // a dark treatment regardless of theme.
    forceDarkPalette?: boolean;
  }>(),
  {
    preset: "",
    blur: VISUALIZER_BLUR_DEFAULT,
    opacity: VISUALIZER_OPACITY_DEFAULT,
    playerId: "",
    coveredWhenFullscreen: false,
    forceDarkPalette: false,
  },
);

const canvasRef = ref<HTMLCanvasElement>();
const covered = computed(
  () => props.coveredWhenFullscreen && store.showFullscreenPlayer,
);

// On a dashboard viewer these resolve to the casting user's preferences.
const qualityPref = visualizerPreference<string>(
  "visualizer_quality",
  DEFAULT_QUALITY,
);
const presetModePref = visualizerPreference<string>(
  "visualizer_preset_mode",
  "random",
);
const favoritesPref = visualizerPreference<string[]>(
  "visualizer_favorites",
  [],
);
const beatSwitchPref = visualizerPreference<boolean>(
  "visualizer_beat_switch",
  false,
);
const beatDwellPref = visualizerPreference<number>("visualizer_beat_dwell", 30);

// An unresolved player keeps rendering: with no id there is no relay
// connection either, so there is nothing to wind down.
const playbackPaused = computed(() => {
  const player = props.playerId ? api.players?.[props.playerId] : undefined;
  return !!player && player.playback_state !== PlaybackState.PLAYING;
});

const {
  streaming,
  colorPalette,
  paletteColorsSupported,
  paletteRampSupported,
  faded,
  currentEngine,
  setPaused,
  rebuildForQuality,
} = useVisualizerCanvasEngine({
  canvas: canvasRef,
  playerId: () => props.playerId,
  covered: () => covered.value,
  quality: () => qualityPref.value,
  applyPreset: (blendSec) => applyPreset(blendSec),
  applyPalette: () => {
    applyPaletteColors();
    applyPaletteRamp();
  },
  paused: () => playbackPaused.value,
  onDownbeat: () => onDownbeat(),
});

const { paletteColors, paletteRamp, paletteRampStrength } =
  useVisualizerPalette({
    palette: colorPalette,
    forceDark: () => props.forceDarkPalette,
    paletteColorsSupported,
    paletteRampSupported,
  });

const canvasStyle = computed(() => ({
  filter: props.blur > 0 ? `blur(${props.blur}px)` : undefined,
  // Oversize slightly when blurred so the edge vignette stays off-screen.
  transform: props.blur > 0 ? "scale(1.12)" : undefined,
  // the engine recolors in its own pass, so there is no second layer to fade
  // in step with and the opacity sits on the canvas itself
  opacity: props.opacity < 100 ? String(props.opacity / 100) : undefined,
}));

// The text-legibility scrim fades with the visualizer: a faint overlay
// should not darken the normal background it blends into.
const scrimStyle = computed(() => ({
  opacity: String(props.opacity / 100),
}));

const layerStyle = computed(() => ({
  // Both ends written out: removing the property leaves nothing to transition
  // from and the layer snaps back.
  opacity: faded.value ? String(PAUSED_OPACITY) : "1",
  // Eased to match the waveform envelope at each end.
  transition: faded.value
    ? `opacity ${DECAY_MS}ms ease-out`
    : `opacity ${ATTACK_MS}ms ease-in`,
}));

let lastPresetSwitchAt = 0;

const pickPresetName = async (forceRandom = false): Promise<string | null> => {
  if (!forceRandom && presetModePref.value === "fixed" && props.preset)
    return props.preset;
  const favorites = favoritesPref.value;
  if (presetModePref.value === "random_favorites" && favorites.length > 0) {
    return favorites[Math.floor(Math.random() * favorites.length)];
  }
  return await randomPresetName();
};

let presetRequestId = 0;

const applyPreset = async (blendSec?: number, forceRandom = false) => {
  if (!currentEngine()) return;
  // Preference changes can fire this concurrently (preset + mode are two
  // writes); only the latest request may load, or a stale async pick could
  // override the user's explicit choice.
  const requestId = ++presetRequestId;
  const name = await pickPresetName(forceRandom);
  const engine = currentEngine();
  if (requestId !== presetRequestId || !name || !engine) return;
  lastPresetSwitchAt = performance.now();
  // The engine substitutes a random preset for a name the packs no longer
  // carry, so what is showing is whatever it reports back, not what was asked
  // for.
  const loaded = await engine.loadPresetByName(name, blendSec);
  if (requestId !== presetRequestId || !loaded) return;
  currentVisualizerPreset.value = loaded;
};

// Preset auto-switch on downbeats (MA's neural beat tracker), rate-limited
// by the configured minimum dwell time.
const onDownbeat = () => {
  if (!beatSwitchPref.value) return;
  // Beat schedules are pushed a track ahead and are not cancelled on pause.
  if (playbackPaused.value) return;
  if (performance.now() - lastPresetSwitchAt < beatDwellPref.value * 1000)
    return;
  // Rotation always draws from the random pool: with a fixed preset chosen,
  // that preset is the starting point and beat switching takes precedence.
  void applyPreset(undefined, true);
};

// Gated on support, not on having colors: a null palette is how the engine is
// told to fade the recoloring back out.
const applyPaletteColors = () => {
  if (!paletteColorsSupported.value) return;
  currentEngine()?.setPaletteColors(paletteColors.value);
};

const applyPaletteRamp = () => {
  if (!paletteRampSupported.value) return;
  currentEngine()?.setPaletteRamp(paletteRamp.value, paletteRampStrength.value);
};

watch(paletteColors, applyPaletteColors);
watch([paletteRamp, paletteRampStrength], applyPaletteRamp);

watch(playbackPaused, (isPaused) => setPaused(isPaused, PAUSE_SETTLE_MS));

// Quality changes need a fresh butterchurn instance (mesh/texture sizes are
// fixed at creation).
watch(() => qualityPref.value, rebuildForQuality);

watch(
  () => [props.preset, presetModePref.value],
  () => void applyPreset(),
);
</script>

<style scoped>
.visualizer-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.visualizer-layer__stack {
  position: absolute;
  inset: 0;
}

.visualizer-layer__canvas {
  width: 100%;
  height: 100%;
  display: block;
  /* An aspect-capped buffer (TV square render) is cropped, never stretched. */
  object-fit: cover;
}

.visualizer-layer__scrim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
}
</style>
