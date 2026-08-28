/**
 * Tiny shared state and defaults for the visualizer.
 * The canvas picks presets internally (random modes), so controls that act
 * on "the preset currently showing" read it from here.
 */

import { ref } from "vue";

export const currentVisualizerPreset = ref<string | null>(null);

// Defaults for the blur/opacity preferences. Every reader goes through these
// (settings page, fullscreen menu, useVisualizer, and the canvas prop
// fallbacks) so the four cannot drift apart.
export const VISUALIZER_BLUR_DEFAULT = 0;
export const VISUALIZER_OPACITY_DEFAULT = 40;
// The ramp only reads differently in large jumps, so it steps rather than
// sliding freely; 0 is off and skips the shader work entirely.
export const VISUALIZER_PALETTE_RAMP_STEP = 25;
export const VISUALIZER_PALETTE_RAMP_DEFAULT = 75;
