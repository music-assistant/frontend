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
import {
  boundedRenderSize,
  qualityProfile,
  type QualityProfile,
} from "@/helpers/visualizer/quality";
import {
  createTickEstimator,
  pacedIntervalMs,
  pacingThresholdMs,
} from "@/helpers/visualizer/framePacing";
import {
  createPerfSampler,
  type VisualizerPerfSample,
} from "@/helpers/visualizer/perfSampler";

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
  /**
   * Load a preset by name, falling back to a random one when the name is not
   * in the loaded packs. Resolves with the name actually put on screen, or ""
   * when nothing could be loaded.
   */
  loadPresetByName(name: string, blendSec?: number): Promise<string>;
  loadRandomPreset(): Promise<string>;
  /**
   * Suspend the render loop (playback paused/stopped) or resume it.
   *
   * @param ramp - ramp the waveform down/up first; false switches on the spot.
   */
  setPaused(paused: boolean, ramp?: boolean): void;
  /**
   * Retune the drawing-buffer size in place. Only valid for profiles that
   * share the running engine's mesh and FXAA settings (see `needsRebuild`).
   */
  setProfile(profile: QualityProfile): void;
  /**
   * Color the preset's own waveform and borders from the artwork palette,
   * instead of washing the whole frame in a single hue. A no-op on engines
   * without the capability. Transitions over 1.5s.
   *
   * :param colors: Four 0-255 rgb triples (waveform, outer border, inner
   *   border, motion vectors), or null to fade them back to the preset's own
   *   colors.
   */
  setPaletteColors(
    colors: readonly (readonly [number, number, number])[] | null,
  ): void;
  /**
   * Remap the whole image into a palette ramp, keeping the preset's own
   * luminance. A no-op on engines without the capability.
   *
   * :param colors: Ramp anchors ordered dark to light as 0-255 rgb triples,
   *   or null to fade the remap out.
   * :param strength: 0-1 blend strength at the end of the transition.
   */
  setPaletteRamp(
    colors: readonly (readonly [number, number, number])[] | null,
    strength: number,
  ): void;
  // whether this engine can take palette colors at all
  readonly paletteColorsSupported: boolean;
  // whether this engine can remap the image to a palette ramp
  readonly paletteRampSupported: boolean;
  // what the GL context reports it is drawing with
  readonly renderer: string;
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
const UNKNOWN_RENDERER = "unknown";
let probedRenderer = UNKNOWN_RENDERER;

export function isVisualizerSupported(): boolean {
  if (webgl2Supported === null) {
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = document.createElement("canvas").getContext("webgl2");
      webgl2Supported = !!gl;
    } catch {
      webgl2Supported = false;
    }
    // Separately guarded: the unmasked string names the actual driver (a
    // software rasterizer also reports WebGL2), but a driver that throws on
    // the query must cost us the string, not the visualizer.
    if (gl) {
      try {
        const info = gl.getExtension("WEBGL_debug_renderer_info");
        probedRenderer =
          String(
            (info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) ||
              gl.getParameter(gl.RENDERER),
          ) || UNKNOWN_RENDERER;
      } catch {
        probedRenderer = UNKNOWN_RENDERER;
      }
    }
  }
  return webgl2Supported;
}

/**
 * What this device reports it draws with.
 *
 * Read from the support probe rather than the visualizer's canvas: butterchurn
 * renders into its own OffscreenCanvas and takes a 2D context on the canvas it
 * is given, so asking that canvas for a webgl2 context returns null and would
 * report every display as unknown.
 */
export function visualizerRenderer(): string {
  isVisualizerSupported();
  return probedRenderer;
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
  // upper bound on render rate; the loop renders on a whole vsync divisor at or below it
  maxFps?: number;
  // called with achieved render performance roughly every 2s of visible rendering
  onPerfSample?: (sample: VisualizerPerfSample) => void;
}

// samples taken while a preset blend renders both presets (or while the new
// one compiles) measure a workload that is about to vanish; skip them
const PERF_BLEND_SETTLE_MS = 500;

/**
 * Create the engine on a canvas. Returns null when WebGL2 is unavailable.
 *
 * @param canvas - the target canvas element.
 * @param getFrame - returns the waveform frame for "now", or null when none.
 * @param quality - a quality profile, or the name of a user-facing tier.
 * @param options - extra engine options, e.g. a frame rate cap.
 */
export async function createVisualizerEngine(
  canvas: HTMLCanvasElement,
  getFrame: () => Uint8Array | null,
  quality?: string | QualityProfile,
  options?: VisualizerEngineOptions,
): Promise<VisualizerEngine | null> {
  if (!isVisualizerSupported()) return null;
  const butterchurn = resolveButterchurnModule(await import("butterchurn"));
  const paletteColorsSupported = butterchurn.supportsPaletteColors === true;
  const paletteRampSupported = butterchurn.supportsPaletteRamp === true;
  sharedAudioContext ??= new AudioContext();
  let profile = typeof quality === "object" ? quality : qualityProfile(quality);

  // Butterchurn's screen pass sets the GL viewport to exactly the width and
  // height it was given (its pixelRatio option only scales internal render
  // textures and defaults to devicePixelRatio, double-scaling if unmanaged).
  // So: size the canvas drawing buffer ourselves, hand butterchurn those
  // same dimensions, and pin its pixelRatio to 1. The quality profile
  // supplies the dpr cap, render scale, aspect cap and pixel budget (CSS
  // scales the result up; `object-fit: cover` crops when the aspect was
  // capped below the element's).
  const deviceSize = () => {
    const scale =
      Math.min(window.devicePixelRatio || 1, profile.maxDpr) *
      profile.renderScale;
    return boundedRenderSize(
      Math.round(canvas.clientWidth * scale),
      Math.round(canvas.clientHeight * scale),
      profile,
    );
  };
  let currentPresetName = "";

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
      // v3 presets ship eel-compiled equations only; never fall back to the JS interpreter
      onlyUseWASM: true,
    },
  );

  const renderer = visualizerRenderer();

  let rafHandle: number | null = null;
  let lastFrame: Uint8Array = SILENCE;
  let lastFrameAt = 0;
  let destroyed = false;
  let paused = false;
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
    // A halted stretch must not read as slow when the loop resumes: drop the
    // open sample window and cadence marks, as the hidden-tab path does.
    sampler.reset();
    lastTickAt = 0;
    lastRenderAt = 0;
  };

  // Nothing redraws while the loop is halted, so whatever invalidated the
  // canvas has to put a frame back up itself.
  const redrawIfHalted = () => {
    if (rafHandle === null && !destroyed) renderFrame(SILENCE);
  };

  const applySize = () => {
    const size = deviceSize();
    if (!size.width || !size.height) return;
    if (size.width === width && size.height === height) return;
    width = size.width;
    height = size.height;
    canvas.width = width;
    canvas.height = height;
    visualizer.setRendererSize(width, height, { pixelRatio: 1 });
    // Resizing clears the drawing buffer, taking the frozen picture with it.
    redrawIfHalted();
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

  // Pacing is a time gate on the measured tick; see pacingThresholdMs. Until
  // the estimator's first window lands the divisor rests on an assumed 60Hz,
  // which is not worth measuring against.
  const ticks = createTickEstimator();
  const maxFps = options?.maxFps ?? 0;
  const targetIntervalMs = maxFps ? 1000 / maxFps : 0;
  let lastTickAt = 0;
  let lastRenderAt = 0;

  // perf sampling for adaptive hosts; a no-op sampler everywhere else
  const sampler = createPerfSampler(options?.onPerfSample);

  const renderLoop = () => {
    if (destroyed) return;
    rafHandle = requestAnimationFrame(renderLoop);
    if (document.visibilityState !== "visible") {
      // a background stretch must not read as slow
      sampler.reset();
      lastTickAt = 0;
      lastRenderAt = 0;
      return;
    }
    const now = performance.now();
    ticks.observe(now, lastTickAt);
    lastTickAt = now;
    if (
      targetIntervalMs &&
      lastRenderAt &&
      now - lastRenderAt < pacingThresholdMs(targetIntervalMs, ticks.tickMs)
    ) {
      return;
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
        lastFrameAt = now;
      } else if (now - lastFrameAt > STARVATION_MS) {
        lastFrame = SILENCE;
      }
    }
    // timed from here, not from the callback's entry: the tick estimator and
    // the frame fetch above are not what renderMs is meant to report
    const renderStart = performance.now();
    renderFrame(applyGain(lastFrame, gain));
    const renderCost = performance.now() - renderStart;

    const renderedAt = lastRenderAt;
    lastRenderAt = now;
    if (!sampler.enabled) return;
    if (!ticks.estimated) {
      sampler.reset();
      return;
    }
    sampler.onRender({
      now,
      renderedAt,
      renderMs: renderCost,
      // measured against the cadence the loop actually paces at, not the
      // maxFps cap: the two differ whenever the cap is not a whole divisor of
      // the panel
      expectedIntervalMs: pacedIntervalMs(targetIntervalMs, ticks.tickMs),
      tickMs: ticks.tickMs,
      pixels: width * height,
      preset: currentPresetName,
      gpu: () => visualizer.getGpuTimings?.() ?? undefined,
    });
  };

  const resizeObserver = new ResizeObserver(() => applySize());
  resizeObserver.observe(canvas);

  rafHandle = requestAnimationFrame(renderLoop);

  return {
    renderer,
    paletteColorsSupported,
    paletteRampSupported,
    async loadPresetByName(name: string, blendSec = PRESET_BLEND_SEC) {
      // A stored preset name outlives the pack that held it: the v3 packs
      // renamed and dropped presets, so a fixed or favourited choice saved
      // against v2 can be gone. Fall back rather than leaving the canvas blank.
      let loadedName = name;
      let preset = await getPreset(name);
      if (!preset) {
        loadedName = await randomPresetName();
        preset = loadedName ? await getPreset(loadedName) : undefined;
      }
      if (!preset || destroyed) return "";
      currentPresetName = loadedName;
      // A halted loop has no frames to blend across.
      const blend = rafHandle === null ? 0 : blendSec;
      await visualizer.loadPreset(preset, blend);
      // the WASM equation compile stalls the loop; keep it out of the open sample window
      sampler.reset();
      sampler.guardUntil(
        performance.now() + blend * 1000 + PERF_BLEND_SETTLE_MS,
      );
      redrawIfHalted();
      return loadedName;
    },
    async loadRandomPreset() {
      const name = await randomPresetName();
      const preset = await getPreset(name);
      if (preset && !destroyed) {
        currentPresetName = name;
        await visualizer.loadPreset(preset, 0);
        sampler.reset();
        sampler.guardUntil(performance.now() + PERF_BLEND_SETTLE_MS);
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
    setPaletteColors(colors) {
      if (destroyed) return;
      visualizer.setPaletteColors?.(colors);
    },
    setPaletteRamp(colors, strength) {
      if (destroyed) return;
      visualizer.setPaletteRamp?.(colors, strength);
    },
    setProfile(next: QualityProfile) {
      if (destroyed) return;
      profile = next;
      applySize();
      // a resize mid-measurement would be blamed on the new size
      sampler.reset();
      lastRenderAt = 0;
    },
    destroy() {
      destroyed = true;
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
      resizeObserver.disconnect();
      sampler.destroy();
      // Every engine holds its own WebGL2 context and rebuilds are routine;
      // Chrome drops the oldest live context on overflow.
      visualizer.loseGLContext?.();
    },
  };
}
