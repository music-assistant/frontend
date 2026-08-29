/**
 * Engine and relay lifecycle for the visualizer canvas.
 *
 * Owns the butterchurn instance, the relay connection and the adaptive quality
 * ladder, so the component is left with rendering and preferences. Startup is
 * deferred until the canvas has real layout size, and everything is torn down
 * while another view covers it.
 */

import { onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";
import {
  createVisualizerEngine,
  isVisualizerSupported,
  type VisualizerEngine,
} from "@/composables/visualizer/useVisualizerEngine";
import { currentVisualizerPreset } from "@/composables/visualizer/state";
import {
  createAdaptiveQualityController,
  TV_TARGET_FPS,
} from "@/helpers/visualizer/adaptiveQuality";
import api from "@/plugins/api";
import { authManager } from "@/plugins/auth";
import {
  type ColorPalette,
  VisualizerRelayClient,
  installVisualizerErrorReporting,
  reportVisualizerCapability,
  reportVisualizerRender,
} from "@/plugins/visualizer-relay";

export interface VisualizerCanvasEngineOptions {
  canvas: Ref<HTMLCanvasElement | undefined>;
  /** The player whose group to visualize; empty until the host resolves it. */
  playerId: () => string;
  /** Another view is on top; release the GPU and socket while it is. */
  covered: () => boolean;
  /** The user-facing quality tier, ignored on adaptive displays. */
  quality: () => string;
  /** Put the current preset on screen. Called once per engine. */
  applyPreset: (blendSec?: number) => Promise<void>;
  /** Hand the fresh engine its palette. Called once per engine. */
  applyPalette: () => void;
  /** Whether playback is paused, so a fresh engine can start wound down. */
  paused: () => boolean;
  /** A downbeat arrived on the relay. */
  onDownbeat: () => void;
}

export function useVisualizerCanvasEngine(
  options: VisualizerCanvasEngineOptions,
) {
  const streaming = ref(false);
  const colorPalette = ref<ColorPalette>({});
  const paletteColorsSupported = ref(false);
  const paletteRampSupported = ref(false);
  const faded = ref(options.paused());

  // A dashboard viewer is a cast receiver or TV: quality adapts to measured
  // performance rather than a preference nobody there can reach.
  const constrainedDisplay = authManager.isDashboardViewer();

  let engine: VisualizerEngine | null = null;
  let relay: VisualizerRelayClient | null = null;
  let initialized = false;
  let sizeObserver: ResizeObserver | null = null;
  let engineRequestId = 0;
  let pauseTimer: number | null = null;

  const currentEngine = () => engine;

  // Its state deliberately survives engine rebuilds and cover cycles; the
  // hardware does not change between them.
  const adaptive = createAdaptiveQualityController({
    applyProfile: (profile, rebuild) => {
      // mesh density and FXAA are fixed at construction, the rest resizes
      if (engine && !rebuild) {
        engine.setProfile(profile);
        return;
      }
      void createEngine();
    },
    report: (sample, level, note) => {
      void reportVisualizerRender(sample, level, note);
    },
  });

  const clearPauseTimer = () => {
    if (pauseTimer === null) return;
    clearTimeout(pauseTimer);
    pauseTimer = null;
  };

  const connectRelay = () => {
    relay?.close();
    relay = null;
    // Don't carry the old player's palette over until the new relay speaks.
    colorPalette.value = {};
    // Without a player the server would pick one itself, so a canvas mounted
    // before its view resolved the player would visualize a different one.
    if (!options.playerId()) {
      streaming.value = false;
      return;
    }
    relay = new VisualizerRelayClient(
      {
        onState: (state) => {
          streaming.value = state === "streaming";
        },
        onDownbeat: options.onDownbeat,
        onColor: (palette) => {
          colorPalette.value = palette;
        },
      },
      options.playerId(),
    );
    relay.connect();
  };

  const createEngine = async () => {
    if (!options.canvas.value) return;
    // Rapid quality changes must not leave two butterchurn instances (and two
    // rAF loops) on one canvas: only the newest request keeps its engine.
    const requestId = ++engineRequestId;
    engine?.destroy();
    engine = null;
    let created: VisualizerEngine | null = null;
    try {
      created = await createVisualizerEngine(
        options.canvas.value,
        () => (relay ? relay.currentFrame() : null),
        constrainedDisplay ? adaptive.currentProfile() : options.quality(),
        constrainedDisplay
          ? { maxFps: TV_TARGET_FPS, onPerfSample: adaptive.onPerfSample }
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
    paletteColorsSupported.value = engine?.paletteColorsSupported ?? false;
    paletteRampSupported.value = engine?.paletteRampSupported ?? false;
    if (!engine) return;
    // Started up paused: nothing on screen to wind down.
    if (options.paused() && pauseTimer === null) {
      engine.setPaused(true, false);
      faded.value = true;
    }
    options.applyPalette();
    await options.applyPreset(0);
  };

  const initialize = async () => {
    if (initialized || !options.canvas.value) return;
    initialized = true;
    // consoleless displays report their uncaught errors to the server log
    installVisualizerErrorReporting();
    connectRelay();
    await createEngine();
    if (engine) {
      // The player can resolve while the engine's chunk is still downloading,
      // and the watcher below skips that window; catch it up here.
      if (options.playerId() && !relay) connectRelay();
      // Fleet data: cast receivers and TVs have no reachable console, so this
      // is where their support becomes visible.
      void reportVisualizerCapability("butterchurn", engine.renderer);
      return;
    }
    // WebGL2 unavailable or init failure: leave the layer transparent, but say
    // why over the relay first, for displays with no reachable console.
    const reason = isVisualizerSupported()
      ? "visualizer engine failed to start"
      : "WebGL2 unavailable in this browser";
    console.warn(`[visualizer] ${reason}, falling back to gradient`);
    relay?.reportError(reason);
    relay?.close();
    relay = null;
    // Let the mount/uncover/resize paths retry from scratch, relay included.
    initialized = false;
  };

  // A canvas hidden behind a dialog transition (or briefly laid out at zero)
  // reports 0x0; initialising then sizes the drawing buffer to nothing. Safe to
  // call repeatedly: initialize() and the observer both no-op once running.
  const initializeWhenSized = () => {
    const canvas = options.canvas.value;
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
      // The fullscreen player may have opened while this canvas was still
      // waiting for layout; the uncover path calls back in.
      if (options.covered()) return;
      if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
        sizeObserver?.disconnect();
        sizeObserver = null;
        void initialize();
      }
    });
    sizeObserver.observe(canvas);
  };

  /** Wind down on pause after a settle delay, or come back immediately. */
  const setPaused = (isPaused: boolean, settleMs: number) => {
    clearPauseTimer();
    if (isPaused) {
      pauseTimer = window.setTimeout(() => {
        pauseTimer = null;
        // Ramp and fade run together; the loop halts as the fade lands.
        engine?.setPaused(true);
        faded.value = true;
      }, settleMs);
      return;
    }
    engine?.setPaused(false);
    faded.value = false;
  };

  /** Rebuild at a new quality tier. Adaptive displays ignore the preference. */
  const rebuildForQuality = () => {
    if (constrainedDisplay) return;
    // Not while covered: the uncover path recreates it at the current quality.
    if (initialized && !options.covered()) void createEngine();
  };

  const teardown = () => {
    clearPauseTimer();
    engine?.destroy();
    engine = null;
    relay?.close();
    relay = null;
    currentVisualizerPreset.value = null;
  };

  onMounted(() => {
    if (options.covered()) return;
    initializeWhenSized();
  });

  // Release GPU and socket while covered; restore when revealed. A canvas that
  // first mounted while covered has never initialised, so uncovering must start
  // it up rather than only reconnecting an existing engine.
  watch(
    () => options.covered(),
    (isCovered) => {
      if (isCovered) {
        if (!initialized) return;
        teardown();
      } else if (!initialized) {
        initializeWhenSized();
      } else {
        connectRelay();
        void createEngine();
      }
    },
  );

  // Follow the viewed player. Not gated on the engine: it can still be building
  // when the host resolves its player, and that reconnect must not be dropped.
  watch(
    () => options.playerId(),
    () => {
      if (initialized) connectRelay();
    },
  );

  onBeforeUnmount(() => {
    sizeObserver?.disconnect();
    sizeObserver = null;
    teardown();
  });

  return {
    streaming,
    colorPalette,
    paletteColorsSupported,
    paletteRampSupported,
    faded,
    currentEngine,
    setPaused,
    rebuildForQuality,
  };
}
