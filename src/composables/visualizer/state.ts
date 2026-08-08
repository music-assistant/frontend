/**
 * Tiny shared state between the visualizer canvas and its controls.
 * The canvas picks presets internally (random modes), so controls that act
 * on "the preset currently showing" read it from here.
 */

import { ref } from "vue";

export const currentVisualizerPreset = ref<string | null>(null);
