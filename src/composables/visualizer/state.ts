/**
 * Tiny shared state and defaults for the visualizer.
 * The canvas picks presets internally (random modes), so controls that act
 * on "the preset currently showing" read it from here.
 */

import { ref } from "vue";

export const currentVisualizerPreset = ref<string | null>(null);

// Whether the rendering canvas is currently painting a color tint (the server
// sent a usable color; controlled by the MilkDrop Visualizer provider's
// color_tint setting). Views outside the canvas (e.g. the fullscreen OSD's
// text-color logic) read this to know the scrim already covers legibility,
// instead of guessing from the opacity level.
export const visualizerTintActive = ref(false);

// Defaults for the blur/opacity preferences. Every reader goes through these
// (settings page, fullscreen menu, useVisualizer, and the canvas prop
// fallbacks) so the four cannot drift apart.
export const VISUALIZER_BLUR_DEFAULT = 0;
export const VISUALIZER_OPACITY_DEFAULT = 40;
