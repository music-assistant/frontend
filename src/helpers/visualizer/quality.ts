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

/**
 * Resolve a stored preference value to a profile, tolerating unknown values.
 */
export function qualityProfile(value: string | undefined): QualityProfile {
  if (value && value in QUALITY_PROFILES) {
    return QUALITY_PROFILES[value as VisualizerQuality];
  }
  return QUALITY_PROFILES[DEFAULT_QUALITY];
}
