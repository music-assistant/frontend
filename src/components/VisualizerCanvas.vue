<!--
  MilkDrop (butterchurn) visualizer layer.

  Renders behind the view content (absolute, z-index 0, no pointer events),
  fed by MA core's visualizer relay. A subtle scrim keeps overlaid text
  legible; the blur option previews the "ambient background" treatment.
  Renders nothing (transparent) while unsupported or disconnected, so the
  regular gradient background underneath stays visible.
-->
<template>
  <div class="visualizer-layer" aria-hidden="true">
    <canvas
      ref="canvasRef"
      class="visualizer-layer__canvas"
      :style="canvasStyle"
    ></canvas>
    <div
      v-if="streaming"
      class="visualizer-layer__scrim"
      :style="scrimStyle"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  createVisualizerEngine,
  type VisualizerEngine,
  isVisualizerSupported,
} from "@/composables/visualizer/useVisualizerEngine";
import { visualizerPreference } from "@/composables/visualizer/useVisualizer";
import { currentVisualizerPreset } from "@/composables/visualizer/state";
import { randomPresetName } from "@/helpers/visualizer/presetLibrary";
import {
  DEFAULT_QUALITY,
  TV_START_QUALITY,
  stepDownQuality,
} from "@/helpers/visualizer/quality";
import api from "@/plugins/api";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";
import {
  VisualizerRelayClient,
  reportVisualizerCapability,
} from "@/plugins/visualizer-relay";

const props = withDefaults(
  defineProps<{
    // preset name; empty string = random pick
    preset?: string;
    // blur radius in px, 0 = off
    blur?: number;
    // visualizer opacity 0-100; below 100 the background gradient blends through
    opacity?: number;
    // MA player id whose group to visualize; empty = server picks the playing one
    playerId?: string;
    // Suspend while another view covers this one (e.g. the fullscreen player
    // opened on top of a dashboard), so only one engine renders at a time.
    coveredWhenFullscreen?: boolean;
  }>(),
  {
    preset: "",
    blur: 0,
    opacity: 100,
    playerId: "",
    coveredWhenFullscreen: false,
  },
);

const canvasRef = ref<HTMLCanvasElement>();
const streaming = ref(false);
const covered = computed(
  () => props.coveredWhenFullscreen && store.showFullscreenPlayer,
);
let relay: VisualizerRelayClient | null = null;
let engine: VisualizerEngine | null = null;

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

const canvasStyle = computed(() => ({
  filter: props.blur > 0 ? `blur(${props.blur}px)` : undefined,
  // Oversize slightly when blurred so the edge vignette stays off-screen.
  transform: props.blur > 0 ? "scale(1.12)" : undefined,
  opacity: props.opacity < 100 ? String(props.opacity / 100) : undefined,
}));

// The text-legibility scrim fades with the visualizer: a faint overlay
// should not darken the normal background it blends into.
const scrimStyle = computed(() => ({
  opacity: String(props.opacity / 100),
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
  if (!engine) return;
  // Preference changes can fire this concurrently (preset + mode are two
  // writes); only the latest request may load, or a stale async pick could
  // override the user's explicit choice.
  const requestId = ++presetRequestId;
  const name = await pickPresetName(forceRandom);
  if (requestId !== presetRequestId || !name || !engine) return;
  lastPresetSwitchAt = performance.now();
  currentVisualizerPreset.value = name;
  await engine.loadPresetByName(name, blendSec);
};

// Preset auto-switch on downbeats (MA's neural beat tracker), rate-limited
// by the configured minimum dwell time.
const onDownbeat = () => {
  if (!beatSwitchPref.value) return;
  if (performance.now() - lastPresetSwitchAt < beatDwellPref.value * 1000)
    return;
  // Rotation always draws from the random pool: with a fixed preset chosen,
  // that preset is the starting point and beat switching takes precedence.
  void applyPreset(undefined, true);
};

// Adaptive quality for TV/cast displays: start at the sharp-but-bounded tv
// tier, step down after ~6s of sustained sub-target rendering, or right away
// when a sample shows the tier is hopeless. Down-only per mount: no
// oscillation, and the next cast retries from the start tier.
const TV_TARGET_FPS = 30;
const TV_LOW_FPS_RATIO = 0.8;
const TV_FAST_FAIL_RATIO = 0.5;
const TV_LOW_SAMPLES_TO_STEP = 3;
let adaptiveQuality: string = TV_START_QUALITY;
let consecutiveLowSamples = 0;

const onTvFpsSample = (fps: number) => {
  if (fps >= TV_TARGET_FPS * TV_LOW_FPS_RATIO) {
    consecutiveLowSamples = 0;
    return;
  }
  consecutiveLowSamples += 1;
  const hopeless = fps < TV_TARGET_FPS * TV_FAST_FAIL_RATIO;
  if (!hopeless && consecutiveLowSamples < TV_LOW_SAMPLES_TO_STEP) return;
  consecutiveLowSamples = 0;
  const nextTier = stepDownQuality(adaptiveQuality);
  if (!nextTier) return;
  console.info(
    `[visualizer] ${Math.round(fps)}fps sustained at '${adaptiveQuality}', stepping down to '${nextTier}'`,
  );
  adaptiveQuality = nextTier;
  void createEngine();
};

let initialized = false;
let sizeObserver: ResizeObserver | null = null;

const connectRelay = () => {
  relay?.close();
  relay = new VisualizerRelayClient(
    {
      onState: (state) => {
        streaming.value = state === "streaming";
      },
      onDownbeat,
    },
    props.playerId || undefined,
  );
  relay.connect();
};

const initialize = async () => {
  if (initialized || !canvasRef.value) return;
  initialized = true;
  connectRelay();
  await createEngine();
  if (engine) {
    // Fleet data: this display renders MilkDrop. Cast receivers and TVs have
    // no reachable console, so this is where their support becomes visible.
    void reportVisualizerCapability("butterchurn");
  }
  if (!engine) {
    // WebGL2 unavailable or init failure: leave the layer transparent. Report it
    // over the relay before closing, so displays with no reachable console (cast
    // receivers, kiosks) still say why they are showing a plain background.
    const reason = isVisualizerSupported()
      ? "visualizer engine failed to start"
      : "WebGL2 unavailable in this browser";
    console.warn(`[visualizer] ${reason}, falling back to gradient`);
    relay?.reportError(reason);
    relay?.close();
    relay = null;
    // Allow the mount/uncover/resize paths to retry from scratch (relay
    // included); a later engine-only recreation would render against no relay.
    initialized = false;
  }
};

let engineRequestId = 0;

const createEngine = async () => {
  if (!canvasRef.value) return;
  // Rapid quality changes must not leave two butterchurn instances (and two
  // rAF loops) on one canvas: only the newest request keeps its engine.
  const requestId = ++engineRequestId;
  engine?.destroy();
  engine = null;
  let created: VisualizerEngine | null = null;
  // A dashboard viewer is a cast receiver or TV, so its quality adapts to
  // measured performance instead of trusting the (unreachable) quality
  // preference: start at native (TV viewports report few CSS pixels behind a
  // high devicePixelRatio, so lower tiers render visibly soft on the panel)
  // and step down when the hardware cannot sustain the capped frame rate.
  const constrainedDisplay = authManager.isDashboardViewer();
  try {
    created = await createVisualizerEngine(
      canvasRef.value,
      () => (relay ? relay.currentFrame() : null),
      constrainedDisplay ? adaptiveQuality : qualityPref.value,
      constrainedDisplay
        ? { maxFps: TV_TARGET_FPS, onFpsSample: onTvFpsSample }
        : undefined,
    );
  } catch (error) {
    console.error("[visualizer] engine init failed:", error);
  }
  if (requestId !== engineRequestId) {
    created?.destroy();
    return;
  }
  engine = created;
  if (engine) await applyPreset(0);
};

// Start once the canvas has real layout size, deferring via a ResizeObserver
// when it hasn't yet. A canvas hidden behind a dialog transition (or briefly
// laid out at zero) reports 0x0; initialising then sizes the drawing buffer to
// nothing. Safe to call repeatedly: initialize() and the observer both no-op
// once running.
const initializeWhenSized = () => {
  const canvas = canvasRef.value;
  if (!canvas || initialized) return;
  // Remote (WebRTC) sessions cannot reach the relay route; starting up would
  // only produce an endless connect/retry loop.
  if (api.isRemoteConnection.value) return;
  if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
    void initialize();
    return;
  }
  if (sizeObserver) return;
  sizeObserver = new ResizeObserver(() => {
    // Re-check covered: the fullscreen player may have opened while this
    // canvas was still waiting for layout; initialising then would start a
    // second engine behind it. The uncover path calls initializeWhenSized
    // again, so a held-back observer still gets its init.
    if (covered.value) return;
    if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
      sizeObserver?.disconnect();
      sizeObserver = null;
      void initialize();
    }
  });
  sizeObserver.observe(canvas);
};

onMounted(() => {
  if (covered.value) return;
  initializeWhenSized();
});

watch(
  () => [props.preset, presetModePref.value],
  () => void applyPreset(),
);

// Quality changes need a fresh butterchurn instance (mesh/texture sizes are
// fixed at creation).
watch(
  () => qualityPref.value,
  () => {
    // Not while covered: the engine is deliberately torn down then, and the
    // uncover path recreates it at the current quality anyway.
    if (initialized && !covered.value) void createEngine();
  },
);

// Release GPU and socket while covered; restore when revealed again. A canvas
// that first mounted while covered has never initialised, so uncovering it must
// start it up rather than only reconnecting an existing engine.
watch(covered, (isCovered) => {
  if (isCovered) {
    if (!initialized) return;
    engine?.destroy();
    engine = null;
    relay?.close();
    relay = null;
    // Drop the shared preset name so the menu doesn't show (or let the star
    // act on) a preset that is no longer rendering. A re-mounting canvas resets
    // it asynchronously in applyPreset, always after this synchronous teardown.
    currentVisualizerPreset.value = null;
  } else if (!initialized) {
    initializeWhenSized();
  } else {
    connectRelay();
    void createEngine();
  }
});

// Follow the viewed player: reconnect the relay when it changes (the engine
// keeps rendering; it pulls from whichever relay instance is current).
watch(
  () => props.playerId,
  () => {
    if (initialized && engine) connectRelay();
  },
);

onBeforeUnmount(() => {
  sizeObserver?.disconnect();
  sizeObserver = null;
  engine?.destroy();
  engine = null;
  relay?.close();
  relay = null;
  currentVisualizerPreset.value = null;
});
</script>

<style scoped>
.visualizer-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.visualizer-layer__canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.visualizer-layer__scrim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
}
</style>
