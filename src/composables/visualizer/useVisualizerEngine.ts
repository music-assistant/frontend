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
import { createTintPass } from "@/helpers/visualizer/tintPass";

const N_SAMPLES = 1024;
const ZERO_LEVEL = 0x80;
const SILENCE = new Uint8Array(N_SAMPLES).fill(ZERO_LEVEL);
const STARVATION_MS = 300;
const PRESET_BLEND_SEC = 2.7;
// The waveform is ramped down to silence over DECAY_MS before the loop halts,
// and back up over ATTACK_MS on resume. Exported so the layer fades in step.
export const DECAY_MS = 1500;
export const ATTACK_MS = 1000;

export interface VisualizerPerfSample {
  // renders actually achieved per second
  fps: number;
  // renders per second the pacing asked for (refresh rate / vsync divisor)
  targetFps: number;
  // share of renders a whole display tick late; only rises when the GPU cannot keep up
  lateRatio: number;
  // drawing-buffer pixels behind those numbers
  pixels: number;
  // mean wall time inside butterchurn's render call
  renderMs: number;
  // share of the window the main thread spent inside long tasks
  blockedRatio: number;
  // GPU section times in ms (EMA), when the driver exposes timer queries
  gpu?: { warp?: number; blur?: number; comp?: number };
  // preset on screen while the window was measured
  preset?: string;
}

export interface VisualizerEngine {
  loadPresetByName(name: string, blendSec?: number): Promise<void>;
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
   * Set or clear the artwork tint (shader-tint engines only; a no-op
   * otherwise). Transitions over the same 1.5s the CSS tint layer uses.
   *
   * :param rgb: 0-255 color channels, or null to fade the tint out.
   */
  setTint(rgb: readonly [number, number, number] | null): void;
  /**
   * Color the preset's own waveform and borders from the artwork palette,
   * instead of washing the whole frame in a single hue. A no-op on engines
   * without the capability. Transitions over the same 1.5s as the tint.
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
  // whether the artwork tint is applied by the engine's own WebGL pass; when
  // false a hosting layer that wants a tint has to apply one itself (CSS)
  readonly shaderTintActive: boolean;
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
  // upper bound on render rate; the loop renders on a whole vsync divisor at or below it
  maxFps?: number;
  // called with achieved render performance roughly every 2s of visible rendering
  onPerfSample?: (sample: VisualizerPerfSample) => void;
  // apply the artwork tint in a WebGL pass (mix-blend-mode: color math) instead of a CSS blend layer
  shaderTint?: boolean;
}

const REFRESH_WINDOW_TICKS = 120;
const MIN_TICK_MS = 1000 / 240;
const MAX_TICK_MS = 1000 / 30;
// Panels come in standard rates; under GPU throttling the rAF gaps are whole
// multiples of the true tick, so the estimator picks the slowest standard rate
// whose multiples explain the window instead of averaging throttled gaps into
// a phantom rate.
const STANDARD_TICKS_MS = [240, 165, 144, 120, 100, 90, 75, 60, 50, 30].map(
  (hz) => 1000 / hz,
);
const TICK_FIT_TOLERANCE = 0.06;
// pacing tolerance: a quarter of the target interval, capped at one tick
const PACING_TOLERANCE_SHARE = 0.25;
// float slop, so 25.000000000000004 / 8.333333333333334 lands on 3 ticks, not 4
const PACING_TICK_EPSILON = 1e-6;

/**
 * The gap after which the pacing gate admits a render.
 *
 * rAF fires on the tick grid, so admitting the tick nearest the target
 * interval stays grid-aligned (no judder), and a GPU-throttled loop whose gaps
 * already exceed the interval is never skipped further.
 */
function pacingThresholdMs(targetIntervalMs: number, tickMs: number): number {
  return (
    targetIntervalMs -
    Math.min(tickMs, targetIntervalMs * PACING_TOLERANCE_SHARE)
  );
}

/**
 * The interval the loop actually renders at: the smallest whole number of
 * display ticks that clears the pacing gate.
 *
 * The maxFps option is only an upper bound. Renders land on the tick grid, so
 * a 30fps cap on a 120Hz panel paces at every third tick (40fps), not 30, and
 * measuring against the cap would under-read both lateness and shortfall.
 */
export function pacedIntervalMs(
  targetIntervalMs: number,
  tickMs: number,
): number {
  if (!targetIntervalMs) return tickMs;
  const ticks = Math.max(
    1,
    Math.ceil(
      pacingThresholdMs(targetIntervalMs, tickMs) / tickMs -
        PACING_TICK_EPSILON,
    ),
  );
  return ticks * tickMs;
}

export function fitStandardTick(gaps: Float64Array): number | null {
  // slowest rate first: every gap trivially fits a fast-enough tick's
  // multiples, so the LARGEST tick that fits is the informative one
  for (let i = STANDARD_TICKS_MS.length - 1; i >= 0; i--) {
    const tick = STANDARD_TICKS_MS[i];
    let residual = 0;
    let ok = true;
    for (const gap of gaps) {
      const k = Math.max(1, Math.round(gap / tick));
      const err = Math.abs(gap - k * tick) / gap;
      if (err > TICK_FIT_TOLERANCE * 3) {
        ok = false;
        break;
      }
      residual += err;
    }
    if (ok && residual / gaps.length <= TICK_FIT_TOLERANCE) return tick;
  }
  return null;
}

// The panel rate is a device property: once any window proves a faster tick,
// a slower estimate later can only mean throttling, never a slower panel.
// Latched at module level so engine rebuilds inherit it.
let latchedTickMs: number | null = null;
const DEFAULT_TICK_MS = 1000 / 60;
const PERF_SAMPLE_WINDOW_MS = 2000;
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
  // fork builds can blend the tint inside their own output pass: one context,
  // one canvas, no per-frame copy
  const engineTint =
    options?.shaderTint === true && butterchurn.supportsEngineTint === true;
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
  // with the shader tint, butterchurn renders into a detached canvas and the visible one shows the tinted copy
  const tintPass =
    options?.shaderTint && !engineTint ? createTintPass(canvas) : null;
  const targetCanvas = tintPass ? document.createElement("canvas") : canvas;

  let currentPresetName = "";

  let { width, height } = deviceSize();
  targetCanvas.width = width;
  targetCanvas.height = height;

  const visualizer: ButterchurnVisualizer = butterchurn.createVisualizer(
    sharedAudioContext,
    targetCanvas,
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

  // the unmasked string names the actual driver (a software rasterizer also reports WebGL2)
  const describeRenderer = (): string => {
    try {
      const gl = canvas.getContext("webgl2");
      if (!gl) return "unknown";
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      return String(
        (info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) ||
          gl.getParameter(gl.RENDERER),
      );
    } catch {
      return "unknown";
    }
  };
  const renderer = describeRenderer();

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
    tintPass?.draw(targetCanvas, performance.now());
  };

  const stopLoop = () => {
    if (rafHandle !== null) cancelAnimationFrame(rafHandle);
    rafHandle = null;
    // A halted stretch must not read as slow when the loop resumes: drop the
    // open sample window and cadence marks, as the hidden-tab path does.
    perfWindowStart = 0;
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
    targetCanvas.width = width;
    targetCanvas.height = height;
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

  // Pacing is a time gate on the measured tick; see pacingThresholdMs.
  let tickMs = DEFAULT_TICK_MS;
  const maxFps = options?.maxFps ?? 0;
  const targetIntervalMs = maxFps ? 1000 / maxFps : 0;
  let lastTickAt = 0;
  let windowTicks = 0;
  const windowDeltas = new Float64Array(REFRESH_WINDOW_TICKS);
  // until the first window lands the divisor rests on an assumed 60Hz; don't measure against that
  let tickEstimated = false;

  // perf sampling for adaptive hosts; resets when hidden so a background stretch cannot read as slow
  let perfWindowStart = 0;
  let perfGuardUntil = 0;
  let perfRenders = 0;
  let perfLateRenders = 0;
  let perfRenderMs = 0;
  let perfBlockedMs = 0;
  let lastRenderAt = 0;

  // long tasks tell a saturated main thread apart from one idling between
  // frames; only adaptive hosts consume the measurement, so nobody else pays
  // for the observer
  let longTaskObserver: PerformanceObserver | null = null;
  if (options?.onPerfSample) {
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) perfBlockedMs += entry.duration;
      });
      longTaskObserver.observe({ entryTypes: ["longtask"] });
    } catch {
      longTaskObserver = null;
    }
  }

  const renderLoop = () => {
    if (destroyed) return;
    rafHandle = requestAnimationFrame(renderLoop);
    if (document.visibilityState !== "visible") {
      perfWindowStart = 0;
      lastTickAt = 0;
      lastRenderAt = 0;
      return;
    }
    const now = performance.now();
    if (lastTickAt) {
      windowDeltas[windowTicks] = now - lastTickAt;
      if (++windowTicks >= REFRESH_WINDOW_TICKS) {
        const fitted = fitStandardTick(windowDeltas);
        let estimate: number;
        if (fitted !== null) {
          estimate = fitted;
        } else {
          // no standard rate explains the window (wild jitter): fall back to
          // the median gap
          const sorted = Array.from(windowDeltas).sort((a, b) => a - b);
          estimate = sorted[REFRESH_WINDOW_TICKS >> 1];
        }
        latchedTickMs =
          latchedTickMs === null ? estimate : Math.min(latchedTickMs, estimate);
        tickMs = Math.min(Math.max(latchedTickMs, MIN_TICK_MS), MAX_TICK_MS);
        windowTicks = 0;
        tickEstimated = true;
      }
    }
    lastTickAt = now;
    if (
      targetIntervalMs &&
      lastRenderAt &&
      now - lastRenderAt < pacingThresholdMs(targetIntervalMs, tickMs)
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
    renderFrame(applyGain(lastFrame, gain));
    const renderCost = performance.now() - now;

    const renderedAt = lastRenderAt;
    lastRenderAt = now;
    if (!options?.onPerfSample || !tickEstimated) {
      perfWindowStart = 0;
      return;
    }
    if (now < perfGuardUntil) {
      perfWindowStart = 0;
      return;
    }
    // the window's opening render marks the start rather than counting
    if (perfWindowStart === 0) {
      perfWindowStart = now;
      perfRenders = 0;
      perfLateRenders = 0;
      perfRenderMs = 0;
      perfBlockedMs = 0;
      return;
    }
    // measured against the cadence the loop actually paces at, not the maxFps
    // cap: the two differ whenever the cap is not a whole divisor of the panel
    const expectedIntervalMs = pacedIntervalMs(targetIntervalMs, tickMs);
    // full-tick tolerance: the controller's thresholds treat "late" as
    // grossly late, not one tick shy of perfect
    if (renderedAt && now - renderedAt > expectedIntervalMs + tickMs) {
      // the scheduled slot passed while the previous render was still on the GPU
      perfLateRenders += 1;
    }
    perfRenders += 1;
    perfRenderMs += renderCost;
    const elapsed = now - perfWindowStart;
    if (elapsed >= PERF_SAMPLE_WINDOW_MS) {
      options.onPerfSample({
        fps: (perfRenders * 1000) / elapsed,
        targetFps: 1000 / expectedIntervalMs,
        lateRatio: perfLateRenders / perfRenders,
        pixels: width * height,
        renderMs: perfRenderMs / perfRenders,
        blockedRatio: Math.min(perfBlockedMs / elapsed, 1),
        gpu: visualizer.getGpuTimings?.() ?? undefined,
        preset: currentPresetName,
      });
      perfWindowStart = now;
      perfRenders = 0;
      perfLateRenders = 0;
      perfRenderMs = 0;
      perfBlockedMs = 0;
    }
  };

  const resizeObserver = new ResizeObserver(() => applySize());
  resizeObserver.observe(canvas);

  rafHandle = requestAnimationFrame(renderLoop);

  return {
    renderer,
    shaderTintActive: tintPass !== null || engineTint,
    paletteColorsSupported,
    paletteRampSupported,
    async loadPresetByName(name: string, blendSec = PRESET_BLEND_SEC) {
      const preset = await getPreset(name);
      if (!preset || destroyed) return;
      currentPresetName = name;
      // A halted loop has no frames to blend across.
      const blend = rafHandle === null ? 0 : blendSec;
      await visualizer.loadPreset(preset, blend);
      // the WASM equation compile stalls the loop; keep it out of the open sample window
      perfWindowStart = 0;
      perfGuardUntil = performance.now() + blend * 1000 + PERF_BLEND_SETTLE_MS;
      redrawIfHalted();
    },
    async loadRandomPreset() {
      const name = await randomPresetName();
      const preset = await getPreset(name);
      if (preset && !destroyed) {
        currentPresetName = name;
        await visualizer.loadPreset(preset, 0);
        perfWindowStart = 0;
        perfGuardUntil = performance.now() + PERF_BLEND_SETTLE_MS;
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
    setTint(rgb) {
      if (engineTint) {
        visualizer.setTint?.(rgb);
      } else {
        tintPass?.setTint(rgb);
      }
    },
    setPaletteColors(colors) {
      visualizer.setPaletteColors?.(colors);
    },
    setPaletteRamp(colors, strength) {
      visualizer.setPaletteRamp?.(colors, strength);
    },
    setProfile(next: QualityProfile) {
      if (destroyed) return;
      profile = next;
      applySize();
      // a resize mid-measurement would be blamed on the new size
      perfWindowStart = 0;
      lastRenderAt = 0;
    },
    destroy() {
      destroyed = true;
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
      resizeObserver.disconnect();
      longTaskObserver?.disconnect();
      tintPass?.destroy();
      // release the detached canvas's GL context, or rebuilds can hit Chrome's live context cap
      if (targetCanvas !== canvas) {
        targetCanvas
          .getContext("webgl2")
          ?.getExtension("WEBGL_lose_context")
          ?.loseContext();
      }
    },
  };
}
