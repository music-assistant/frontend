/**
 * Visualizer quality tiers: one understandable knob bundling render scale,
 * device-pixel-ratio cap, warp mesh density, and FXAA.
 *
 * Rendering cost scales roughly with renderScale² × dpr² (GPU fill) and
 * mesh vertex count (per-vertex preset equations, CPU-bound on the v2
 * engine), so the tiers span tablet-friendly to full retina.
 */

export type VisualizerQuality = "low" | "medium" | "high" | "native";

export interface QualityProfile {
  renderScale: number;
  maxDpr: number;
  meshWidth: number;
  meshHeight: number;
  outputFXAA: boolean;
  // aspect-preserving ceiling on drawing-buffer pixels; the adaptive ladder steps through these
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

// adaptive (TV/cast) ladder: pixel budgets, since the same scale factor lands on wildly different pixel loads across TV viewports
const ADAPTIVE_MESH_WIDTH = 48;
const ADAPTIVE_MESH_HEIGHT = 36;

// square render: most shader presets ignore MilkDrop's aspect uniform and
// stretch on a wide screen, so TV/cast displays render 1:1 and cover-crop
const adaptiveStep = (maxPixels: number): QualityProfile => ({
  renderScale: 1,
  maxDpr: 2,
  meshWidth: ADAPTIVE_MESH_WIDTH,
  meshHeight: ADAPTIVE_MESH_HEIGHT,
  outputFXAA: true,
  maxPixels,
  maxAspect: 1,
});

// roughly ×0.7 in area per step; every step but the last is an in-place resize
export const ADAPTIVE_LADDER: readonly QualityProfile[] = [
  adaptiveStep(2_100_000), // 1080p at devicePixelRatio 2
  adaptiveStep(1_470_000),
  adaptiveStep(1_030_000),
  adaptiveStep(720_000),
  adaptiveStep(500_000),
  adaptiveStep(350_000),
  {
    renderScale: 1,
    maxDpr: 2,
    meshWidth: 32,
    meshHeight: 24,
    outputFXAA: false,
    maxPixels: 250_000,
    maxAspect: 1,
  },
];

// start one below the top; climbing back up is cheap when there is headroom
export const ADAPTIVE_START_LEVEL = 1;

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

/**
 * The adaptive ladder step at the given level, clamped to the ladder's range.
 */
export function adaptiveProfile(level: number): QualityProfile {
  const clamped = Math.min(Math.max(level, 0), ADAPTIVE_LADDER.length - 1);
  return ADAPTIVE_LADDER[clamped];
}

/**
 * Whether moving between two profiles needs a fresh engine rather than an
 * in-place resize: mesh density and FXAA are fixed when butterchurn is built.
 */
export function needsRebuild(a: QualityProfile, b: QualityProfile): boolean {
  return (
    a.meshWidth !== b.meshWidth ||
    a.meshHeight !== b.meshHeight ||
    a.outputFXAA !== b.outputFXAA
  );
}
