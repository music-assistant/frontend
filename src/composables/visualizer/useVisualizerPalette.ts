/**
 * Derives the artwork colours the visualizer applies from the relay's palette:
 * the preset's own element colours, and the luminance ramp that remaps the
 * whole image.
 *
 * The two can be live at once.
 */

import { computed, toValue, type MaybeRefOrGetter, type Ref } from "vue";
import { isDark } from "@/composables/useThemePreference";
import { useUserPreferences } from "@/composables/userPreferences";
import {
  VISUALIZER_PALETTE_COLORS_DEFAULT,
  VISUALIZER_PALETTE_RAMP_DEFAULT,
} from "@/composables/visualizer/state";
import type { ColorPalette } from "@/plugins/visualizer-relay";

type Rgb = [number, number, number];

// Rec.601 luma, the weighting the engine's own blend uses.
const luma = ([r, g, b]: Rgb) => 0.3 * r + 0.59 * g + 0.11 * b;

export interface VisualizerPaletteOptions {
  /** The relay's latest palette for the track on screen. */
  palette: Ref<ColorPalette>;
  /** The host view forces a dark treatment regardless of the app theme. */
  forceDark: MaybeRefOrGetter<boolean>;
}

export function useVisualizerPalette(options: VisualizerPaletteOptions) {
  const { getPreference } = useUserPreferences();
  const paletteColorsPref = getPreference<boolean>(
    "visualizer_palette_colors",
    VISUALIZER_PALETTE_COLORS_DEFAULT,
  );
  const paletteRampPref = getPreference<number>(
    "visualizer_palette_ramp",
    VISUALIZER_PALETTE_RAMP_DEFAULT,
  );

  // Which side of the palette this view shows; every colour below picks from
  // one side only, so two contrast families can never land on screen at once.
  const useDark = computed(() => toValue(options.forceDark) || isDark.value);

  // Backgrounds stay unused here, they are not meant for the thin foreground
  // elements these colors land on. on_dark is the variant meant to be drawn on
  // a dark background, so it is the one a dark treatment takes: a waveform line
  // is drawn at its own brightness and has to contrast.
  const paletteColors = computed<Rgb[] | null>(() => {
    if (!paletteColorsPref.value) return null;
    const wire = options.palette.value;
    const foreground = useDark.value ? wire.on_dark : wire.on_light;
    if (!foreground || !wire.primary) return null;
    // waveform, outer border, inner border, motion vectors; a single-hue
    // artwork has no accent, so the inner border repeats primary.
    return [foreground, wire.primary, wire.accent ?? wire.primary, foreground];
  });

  // Anchors for the engine's luminance ramp, one side of the palette only and
  // ordered dark to light. primary and accent have no variants, so they sit
  // wherever their own brightness puts them.
  const paletteRamp = computed<Rgb[] | null>(() => {
    if (paletteRampPref.value <= 0) return null;
    const wire = options.palette.value;
    const anchors = [
      useDark.value ? wire.background_dark : wire.background_light,
      wire.primary,
      wire.accent,
      useDark.value ? wire.on_dark : wire.on_light,
    ].filter((color): color is Rgb => !!color);
    if (anchors.length === 0) return null;
    return [...anchors].sort((first, second) => luma(first) - luma(second));
  });

  const paletteRampStrength = computed(
    () => Math.min(Math.max(paletteRampPref.value, 0), 100) / 100,
  );

  return {
    paletteColors,
    paletteRamp,
    paletteRampStrength,
  };
}
