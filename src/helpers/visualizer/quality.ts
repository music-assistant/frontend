/**
 * Visualizer quality tiers: one understandable knob bundling render scale,
 * device-pixel-ratio cap, warp mesh density, and FXAA.
 *
 * Rendering cost scales roughly with renderScale² × dpr² (GPU fill) and
 * mesh vertex count (per-vertex preset equations), so the tiers span
 * tablet-friendly to full retina.
 */

export type VisualizerQuality = "low" | "medium" | "high" | "native";

export interface QualityProfile {
  renderScale: number;
  maxDpr: number;
  meshWidth: number;
  meshHeight: number;
  outputFXAA: boolean;
  // aspect-preserving ceiling on drawing-buffer pixels
  maxPixels?: number;
  // widest allowed buffer aspect; the canvas cover-crops the excess instead of stretching
  maxAspect?: number;
}

export const QUALITY_PROFILES: Record<VisualizerQuality, QualityProfile> = {
  low: {
    renderScale: 0.5,
    maxDpr: 1,
    meshWidth: 32,
    meshHeight: 24,
    outputFXAA: false,
  },
  medium: {
    renderScale: 0.75,
    maxDpr: 1,
    meshWidth: 48,
    meshHeight: 36,
    outputFXAA: true,
  },
  high: {
    renderScale: 1,
    maxDpr: 1,
    meshWidth: 64,
    meshHeight: 48,
    outputFXAA: true,
  },
  native: {
    renderScale: 1,
    maxDpr: 2,
    meshWidth: 64,
    meshHeight: 48,
    outputFXAA: true,
  },
};

export const DEFAULT_QUALITY: VisualizerQuality = "high";

/**
 * Resolve a stored preference value to a profile, tolerating unknown values.
 */
export function qualityProfile(value: string | undefined): QualityProfile {
  if (value && value in QUALITY_PROFILES) {
    return QUALITY_PROFILES[value as VisualizerQuality];
  }
  return QUALITY_PROFILES[DEFAULT_QUALITY];
}

// TV/cast displays get one fixed profile: a pixel budget, since the same scale
// factor lands on wildly different pixel loads across TV viewports. Most shader
// presets ignore MilkDrop's aspect uniform and stretch on a wide screen, so it
// renders 1:1 and cover-crops.
const TV_MESH_WIDTH = 48;
const TV_MESH_HEIGHT = 36;
const TV_MAX_PIXELS = 1_030_000;

export const TV_PROFILE: QualityProfile = {
  renderScale: 1,
  maxDpr: 2,
  meshWidth: TV_MESH_WIDTH,
  meshHeight: TV_MESH_HEIGHT,
  outputFXAA: true,
  maxPixels: TV_MAX_PIXELS,
  maxAspect: 1,
};

// render rate cap for TV/cast displays
export const TV_MAX_FPS = 30;

/**
 * Fit a drawing-buffer size to a profile's aspect cap and pixel budget.
 *
 * :param width: The unbounded buffer width in device pixels.
 * :param height: The unbounded buffer height in device pixels.
 * :param profile: The quality profile supplying the bounds.
 */
export function boundedRenderSize(
  width: number,
  height: number,
  profile: QualityProfile,
): { width: number; height: number } {
  // zero means "not laid out yet"; the caller keeps its current size then
  if (!width || !height) return { width, height };
  const aspectCap = profile.maxAspect;
  if (aspectCap) {
    if (width > height * aspectCap) {
      width = Math.round(height * aspectCap);
    } else if (height > width * aspectCap) {
      height = Math.round(width * aspectCap);
    }
  }
  const budget = profile.maxPixels;
  if (budget && width * height > budget) {
    const shrink = Math.sqrt(budget / (width * height));
    // floored so the budget is a true ceiling; rounding up can overshoot it
    width = Math.floor(width * shrink);
    height = Math.floor(height * shrink);
  }
  return { width: Math.max(1, width), height: Math.max(1, height) };
}
