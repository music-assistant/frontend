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

// Internal tiers for adaptive (TV/cast) rendering; deliberately not part of
// QUALITY_PROFILES, which the settings page enumerates as user choices.
// "tv" keeps the full devicePixelRatio for panel sharpness at a bounded pixel
// load (~1440x810 on a 1080p viewport): TV viewports report few CSS pixels
// behind a high dpr, so dpr-clamped tiers render visibly soft there.
const INTERNAL_PROFILES: Record<string, QualityProfile> = {
  tv: {
    renderScale: 0.75,
    maxDpr: 2,
    meshWidth: 48,
    meshHeight: 36,
    outputFXAA: true,
  },
};

/**
 * Resolve a stored preference value to a profile, tolerating unknown values.
 */
export function qualityProfile(value: string | undefined): QualityProfile {
  if (value && value in QUALITY_PROFILES) {
    return QUALITY_PROFILES[value as VisualizerQuality];
  }
  if (value && value in INTERNAL_PROFILES) {
    return INTERNAL_PROFILES[value];
  }
  return QUALITY_PROFILES[DEFAULT_QUALITY];
}

// Degradation ladder for displays that adapt to measured performance (TVs),
// in monotonically decreasing pixel-load order at TV viewports.
export const TV_START_QUALITY = "tv";
const ADAPTIVE_LADDER = ["native", "tv", "high", "medium", "low"];

/**
 * The next tier down from the given one, or null when already at the bottom
 * (or the value is unknown).
 */
export function stepDownQuality(current: string | undefined): string | null {
  const index = current ? ADAPTIVE_LADDER.indexOf(current) : -1;
  if (index === -1) return null;
  return ADAPTIVE_LADDER[index + 1] ?? null;
}
