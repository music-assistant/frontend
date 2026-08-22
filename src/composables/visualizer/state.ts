/**
 * Tiny shared state and defaults for the visualizer.
 * The canvas picks presets internally (random modes), so controls that act
 * on "the preset currently showing" read it from here.
 */

import { ref } from "vue";

export const currentVisualizerPreset = ref<string | null>(null);

// Artwork tint the active canvas is currently applying (null = none), shared
// so the preset hover preview recolors the same way as the main canvas.
export const currentVisualizerTint = ref<string | null>(null);

// The relay-fed canvas registers its waveform source here so other surfaces
// (the preset hover preview) can render against the same live audio. Cleared
// by identity: a torn-down canvas must not unregister its successor.
type FrameSource = () => Uint8Array | null;
let liveFrameSource: FrameSource | null = null;

export function setLiveFrameSource(source: FrameSource): void {
  liveFrameSource = source;
}

export function clearLiveFrameSource(source: FrameSource): void {
  if (liveFrameSource === source) liveFrameSource = null;
}

export function liveVisualizerFrame(): Uint8Array | null {
  return liveFrameSource ? liveFrameSource() : null;
}

// Defaults for the blur/opacity preferences. Every reader goes through these
// (settings page, fullscreen menu, useVisualizer, and the canvas prop
// fallbacks) so the four cannot drift apart.
export const VISUALIZER_BLUR_DEFAULT = 0;
export const VISUALIZER_OPACITY_DEFAULT = 40;
