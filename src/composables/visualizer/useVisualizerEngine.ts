/**
 * Butterchurn render engine: lazy-loads the WebGL visualizer, runs a
 * requestAnimationFrame loop fed by externally supplied waveform frames
 * (uint8 offset-binary, 1024 samples — butterchurn's native buffer size),
 * and handles resize/visibility.
 */

import type { ButterchurnStatic, ButterchurnVisualizer } from "butterchurn";
import {
  getPreset,
  randomPresetName,
} from "@/helpers/visualizer/presetLibrary";
import { qualityProfile } from "@/helpers/visualizer/quality";

const N_SAMPLES = 1024;
const SILENCE = new Uint8Array(N_SAMPLES).fill(0x80);
const STARVATION_MS = 300;
const PRESET_BLEND_SEC = 2.7;

export interface VisualizerEngine {
  loadPresetByName(name: string, blendSec?: number): Promise<void>;
  loadRandomPreset(): Promise<string>;
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

/**
 * Create the engine on a canvas. Returns null when WebGL2 is unavailable.
 *
 * @param canvas - the target canvas element.
 * @param getFrame - returns the waveform frame for "now", or null when none.
 * @param quality - render quality tier; defaults to the "high" profile.
 */
export async function createVisualizerEngine(
  canvas: HTMLCanvasElement,
  getFrame: () => Uint8Array | null,
  quality?: string,
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
  let destroyed = false;

  const renderLoop = () => {
    if (destroyed) return;
    rafHandle = requestAnimationFrame(renderLoop);
    if (document.visibilityState !== "visible") return;
    const frame = getFrame();
    if (frame) {
      lastFrame = frame;
      lastFrameAt = performance.now();
    } else if (performance.now() - lastFrameAt > STARVATION_MS) {
      lastFrame = SILENCE;
    }
    visualizer.render({
      audioLevels: {
        timeByteArray: lastFrame,
        timeByteArrayL: lastFrame,
        timeByteArrayR: lastFrame,
      },
    });
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
  });
  resizeObserver.observe(canvas);

  rafHandle = requestAnimationFrame(renderLoop);

  return {
    async loadPresetByName(name: string, blendSec = PRESET_BLEND_SEC) {
      const preset = await getPreset(name);
      if (preset && !destroyed) visualizer.loadPreset(preset, blendSec);
    },
    async loadRandomPreset() {
      const name = await randomPresetName();
      const preset = await getPreset(name);
      if (preset && !destroyed) visualizer.loadPreset(preset, 0);
      return name;
    },
    destroy() {
      destroyed = true;
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
      resizeObserver.disconnect();
    },
  };
}
