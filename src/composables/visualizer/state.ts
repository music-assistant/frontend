/**
 * Tiny shared state and defaults for the visualizer.
 * The canvas picks presets internally (random modes), so controls that act
 * on "the preset currently showing" read it from here.
 */

import { ref } from "vue";

export const currentVisualizerPreset = ref<string | null>(null);

// A preset tapped in the fullscreen menu, to show on the running canvas right
// away; the menu persists the preference separately (deferred). Wrapped in an
// object so re-auditioning the same name still triggers the canvas watcher.
export const visualizerAuditionRequest = ref<{ name: string } | null>(null);

// Defaults for the blur/opacity preferences. Every reader goes through these
// (settings page, fullscreen menu, useVisualizer, and the canvas prop
// fallbacks) so the four cannot drift apart.
export const VISUALIZER_BLUR_DEFAULT = 0;
export const VISUALIZER_OPACITY_DEFAULT = 40;
