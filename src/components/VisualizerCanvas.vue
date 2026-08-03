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
    />
    <div v-if="streaming" class="visualizer-layer__scrim" :style="scrimStyle" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  createVisualizerEngine,
  type VisualizerEngine,
} from "@/composables/visualizer/useVisualizerEngine";
import { useUserPreferences } from "@/composables/userPreferences";
import { currentVisualizerPreset } from "@/composables/visualizer/state";
import { randomPresetName } from "@/helpers/visualizer/presetLibrary";
import { DEFAULT_QUALITY } from "@/helpers/visualizer/quality";
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import { VisualizerRelayClient } from "@/plugins/visualizer-relay";

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

const { getPreference } = useUserPreferences();
const qualityPref = getPreference<string>(
  "visualizer_quality",
  DEFAULT_QUALITY,
);
const presetModePref = getPreference<string>(
  "visualizer_preset_mode",
  "random",
);
const favoritesPref = getPreference<string[]>("visualizer_favorites", []);
const beatSwitchPref = getPreference<boolean>("visualizer_beat_switch", false);
const beatDwellPref = getPreference<number>("visualizer_beat_dwell", 30);

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
  if (!engine) {
    // WebGL2 unavailable or init failure: leave the layer transparent.
    console.warn("[visualizer] engine unavailable, falling back to gradient");
    relay?.close();
    relay = null;
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
  try {
    created = await createVisualizerEngine(
      canvasRef.value,
      () => (relay ? relay.currentFrame() : null),
      qualityPref.value,
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

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  // Remote (WebRTC) sessions cannot reach the relay route; starting up would
  // only produce an endless connect/retry loop.
  if (api.isRemoteConnection.value) return;
  if (covered.value) return;
  // PlayerFullscreen is mounted twice (desktop + mobile OSD); the hidden twin
  // has a zero-sized canvas and must stay idle: no engine, no relay socket.
  // Initialize only once this instance actually has layout dimensions.
  if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
    void initialize();
    return;
  }
  sizeObserver = new ResizeObserver(() => {
    if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
      sizeObserver?.disconnect();
      sizeObserver = null;
      void initialize();
    }
  });
  sizeObserver.observe(canvas);
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
    if (initialized) void createEngine();
  },
);

// Release GPU and socket while covered; restore when revealed again.
watch(covered, (isCovered) => {
  if (!initialized) return;
  if (isCovered) {
    engine?.destroy();
    engine = null;
    relay?.close();
    relay = null;
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
