/**
 * Butterchurn render engine: lazy-loads the WebGL visualizer, runs a
 * requestAnimationFrame loop fed by externally supplied waveform frames
 * (uint8 offset-binary, 1024 samples — butterchurn's native buffer size),
 * and handles resize/visibility. Presets are driven by frame time as much as
 * by audio, so a paused player needs the loop stopped, not silence fed to it.
 */

import type { ButterchurnStatic, ButterchurnVisualizer } from "butterchurn";
import {
  getPreset,
  randomPresetName,
} from "@/helpers/visualizer/presetLibrary";
import { qualityProfile } from "@/helpers/visualizer/quality";

const N_SAMPLES = 1024;
const ZERO_LEVEL = 0x80;
const SILENCE = new Uint8Array(N_SAMPLES).fill(ZERO_LEVEL);
const STARVATION_MS = 300;
const PRESET_BLEND_SEC = 2.7;
// The waveform is ramped down to silence over DECAY_MS before the loop halts,
// and back up over ATTACK_MS on resume. Exported so the layer fades in step.
export const DECAY_MS = 1500;
export const ATTACK_MS = 1000;

export interface VisualizerEngine {
  loadPresetByName(name: string, blendSec?: number): Promise<void>;
  loadRandomPreset(): Promise<string>;
  /**
   * Suspend the render loop (playback paused/stopped) or resume it.
   *
   * @param ramp - ramp the waveform down/up first; false switches on the spot.
   */
  setPaused(paused: boolean, ramp?: boolean): void;
  destroy(): void;
}

/**
 * Whether the browser can run butterchurn (WebGL2 required).
 *
 * Probed once and cached: this runs inside every hosting view's
 * visualizerActive computed, which re-evaluates on each preference write.
 * An uncached probe would spawn a throwaway WebGL2 context per call, and
 * Chrome drops the oldest live context on overflow — the running visualizer.
 */
let webgl2Supported: boolean | null = null;

export function isVisualizerSupported(): boolean {
  if (webgl2Supported === null) {
    try {
      webgl2Supported = !!document.createElement("canvas").getContext("webgl2");
    } catch {
      webgl2Supported = false;
    }
  }
  return webgl2Supported;
}

// One never-resumed AudioContext satisfies butterchurn's constructor; the
// audio graph is unused because every render supplies external audioLevels.
let sharedAudioContext: AudioContext | null = null;

// The UMD bundle wraps its API in a webpack `default` export, and the
// bundler's CJS interop may add another `default` layer on top; probe the
// possible nestings for the actual API object.
function resolveButterchurnModule(module: unknown): ButterchurnStatic {
  const record = module as Record<string, unknown>;
  const candidates = [
    module,
    record.default,
    (record.default as Record<string, unknown> | undefined)?.default,
  ];
  for (const candidate of candidates) {
    if (
      candidate &&
      typeof (candidate as ButterchurnStatic).createVisualizer === "function"
    ) {
      return candidate as ButterchurnStatic;
    }
  }
  throw new Error("unexpected butterchurn module shape");
}

export interface VisualizerEngineOptions {
  // Upper bound on render rate; rAF ticks above it are skipped. Constrained
  // displays (cast receivers, TVs) cannot sustain 60fps MilkDrop rendering.
  maxFps?: number;
}

/**
 * Create the engine on a canvas. Returns null when WebGL2 is unavailable.
 *
 * @param canvas - the target canvas element.
 * @param getFrame - returns the waveform frame for "now", or null when none.
 * @param quality - render quality tier; defaults to the "high" profile.
 * @param options - extra engine options, e.g. a frame rate cap.
 */
export async function createVisualizerEngine(
  canvas: HTMLCanvasElement,
  getFrame: () => Uint8Array | null,
  quality?: string,
  options?: VisualizerEngineOptions,
): Promise<VisualizerEngine | null> {
  if (!isVisualizerSupported()) return null;
  const butterchurn = resolveButterchurnModule(await import("butterchurn"));
  sharedAudioContext ??= new AudioContext();
  const profile = qualityProfile(quality);

  // Butterchurn's screen pass sets the GL viewport to exactly the width and
  // height it was given (its pixelRatio option only scales internal render
  // textures and defaults to devicePixelRatio, double-scaling if unmanaged).
  // So: size the canvas drawing buffer ourselves, hand butterchurn those
  // same dimensions, and pin its pixelRatio to 1. The quality profile
  // supplies the dpr cap and render scale (CSS stretches the result).
  const scale =
    Math.min(window.devicePixelRatio || 1, profile.maxDpr) *
    profile.renderScale;
  const deviceSize = () => ({
    width: Math.round(canvas.clientWidth * scale),
    height: Math.round(canvas.clientHeight * scale),
  });
  let { width, height } = deviceSize();
  canvas.width = width;
  canvas.height = height;

  const visualizer: ButterchurnVisualizer = butterchurn.createVisualizer(
    sharedAudioContext,
    canvas,
    {
      width,
      height,
      pixelRatio: 1,
      meshWidth: profile.meshWidth,
      meshHeight: profile.meshHeight,
      outputFXAA: profile.outputFXAA,
    },
  );

  let rafHandle: number | null = null;
  let lastFrame: Uint8Array = SILENCE;
  let lastFrameAt = 0;
  let lastRenderAt = 0;
  let destroyed = false;
  let paused = false;
  // Half a 60Hz tick of slack, so a cap of 30 renders every second rAF tick
  // instead of stuttering over 3 ticks when a tick lands fractionally early.
  const minRenderIntervalMs = options?.maxFps
    ? 1000 / options.maxFps - 1000 / 120
    : 0;
  // Gain envelope on the waveform: 0 while paused, 1 while playing. The loop
  // halts once a wind-down lands.
  let rampStartedAt: number | null = null;
  let rampFrom = 1;
  let rampMs = DECAY_MS;
  const scaledFrame = new Uint8Array(N_SAMPLES);

  const renderFrame = (frame: Uint8Array) => {
    visualizer.render({
      audioLevels: {
        timeByteArray: frame,
        timeByteArrayL: frame,
        timeByteArrayR: frame,
      },
    });
  };

  const stopLoop = () => {
    if (rafHandle !== null) cancelAnimationFrame(rafHandle);
    rafHandle = null;
  };

  // Nothing redraws while the loop is halted, so whatever invalidated the
  // canvas has to put a frame back up itself.
  const redrawIfHalted = () => {
    if (rafHandle === null && !destroyed) renderFrame(SILENCE);
  };

  // Squared both ways: the wind-down drops off quickly, the return builds
  // gently. An interrupted ramp carries on from where the envelope stands.
  const currentGain = (): number => {
    const settled = paused ? 0 : 1;
    if (rampStartedAt === null) return settled;
    const t = (performance.now() - rampStartedAt) / rampMs;
    if (t >= 1) {
      rampStartedAt = null;
      return settled;
    }
    return paused
      ? rampFrom * (1 - t) ** 2
      : rampFrom + (1 - rampFrom) * t ** 2;
  };

  const applyGain = (frame: Uint8Array, gain: number): Uint8Array => {
    if (gain >= 1) return frame;
    for (let i = 0; i < N_SAMPLES; i++) {
      scaledFrame[i] = ZERO_LEVEL + Math.round((frame[i] - ZERO_LEVEL) * gain);
    }
    return scaledFrame;
  };

  const renderLoop = () => {
    if (destroyed) return;
    rafHandle = requestAnimationFrame(renderLoop);
    if (document.visibilityState !== "visible") return;
    if (minRenderIntervalMs > 0) {
      const now = performance.now();
      if (now - lastRenderAt < minRenderIntervalMs) return;
      lastRenderAt = now;
    }
    const gain = currentGain();
    if (paused && gain <= 0) {
      // Wound down: only halting the loop stops the time-driven motion.
      renderFrame(SILENCE);
      stopLoop();
      return;
    }
    // The last live waveform is what fades out; nothing is playing to pull.
    if (!paused) {
      const frame = getFrame();
      if (frame) {
        lastFrame = frame;
        lastFrameAt = performance.now();
      } else if (performance.now() - lastFrameAt > STARVATION_MS) {
        lastFrame = SILENCE;
      }
    }
    renderFrame(applyGain(lastFrame, gain));
  };

  const resizeObserver = new ResizeObserver(() => {
    const size = deviceSize();
    if (
      !size.width ||
      !size.height ||
      (size.width === width && size.height === height)
    )
      return;
    width = size.width;
    height = size.height;
    canvas.width = width;
    canvas.height = height;
    visualizer.setRendererSize(width, height, { pixelRatio: 1 });
    // Resizing clears the drawing buffer, taking the frozen picture with it.
    redrawIfHalted();
  });
  resizeObserver.observe(canvas);

  rafHandle = requestAnimationFrame(renderLoop);

  return {
    async loadPresetByName(name: string, blendSec = PRESET_BLEND_SEC) {
      const preset = await getPreset(name);
      if (!preset || destroyed) return;
      // A halted loop has no frames to blend across.
      visualizer.loadPreset(preset, rafHandle === null ? 0 : blendSec);
      redrawIfHalted();
    },
    async loadRandomPreset() {
      const name = await randomPresetName();
      const preset = await getPreset(name);
      if (preset && !destroyed) {
        visualizer.loadPreset(preset, 0);
        redrawIfHalted();
      }
      return name;
    },
    setPaused(value: boolean, ramp = true) {
      if (destroyed || value === paused) return;
      // Read the envelope before the flip, so a ramp can continue from it.
      const from = currentGain();
      paused = value;
      rampStartedAt = ramp ? performance.now() : null;
      rampFrom = from;
      rampMs = paused ? DECAY_MS : ATTACK_MS;
      if (paused) {
        if (!ramp) stopLoop();
        return;
      }
      // Drop the pre-pause tail rather than replaying it.
      lastFrame = SILENCE;
      lastFrameAt = 0;
      if (rafHandle === null) rafHandle = requestAnimationFrame(renderLoop);
    },
    destroy() {
      destroyed = true;
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
      resizeObserver.disconnect();
    },
  };
}
