/**
 * Derives every artwork colour the visualizer can apply from the relay's
 * palette: the flat CSS tint, the preset's own element colours, and the
 * luminance ramp that remaps the whole image.
 *
 * The three are mutually exclusive by construction. The ramp and the element
 * colours are engine capabilities, so both are gated on what the running
 * engine reports it supports; whichever of them is live replaces the flat
 * tint rather than stacking on top of it.
 */

import { computed, toValue, type MaybeRefOrGetter, type Ref } from "vue";
import { visualizerPreference } from "@/composables/visualizer/useVisualizer";
import {
  VISUALIZER_PALETTE_COLORS_DEFAULT,
  VISUALIZER_PALETTE_RAMP_DEFAULT,
} from "@/composables/visualizer/state";
import { paletteFromServer } from "@/helpers/utils";
import type { MediaItemPalette } from "@/plugins/api/interfaces";
import type { ColorPalette } from "@/plugins/visualizer-relay";
import vuetify from "@/plugins/vuetify";

type Rgb = [number, number, number];

// Rec.601 luma, the weighting the engine's own blend uses.
const luma = ([r, g, b]: Rgb) => 0.3 * r + 0.59 * g + 0.11 * b;

export interface VisualizerPaletteOptions {
  /** The relay's latest palette for the track on screen. */
  palette: Ref<ColorPalette>;
  /** The host view forces a dark treatment regardless of the app theme. */
  forceDark: MaybeRefOrGetter<boolean>;
  /** Whether the running engine can colour the preset's own elements. */
  paletteColorsSupported: Ref<boolean>;
  /** Whether the running engine can remap the image to a palette ramp. */
  paletteRampSupported: Ref<boolean>;
}

export function useVisualizerPalette(options: VisualizerPaletteOptions) {
  const paletteColorsPref = visualizerPreference<boolean>(
    "visualizer_palette_colors",
    VISUALIZER_PALETTE_COLORS_DEFAULT,
  );
  const paletteRampPref = visualizerPreference<number>(
    "visualizer_palette_ramp",
    VISUALIZER_PALETTE_RAMP_DEFAULT,
  );

  // Which side of the palette this view shows; every colour below picks from
  // one side only, so two contrast families can never land on screen at once.
  const useDark = computed(
    () => toValue(options.forceDark) || vuetify.theme.current.value.dark,
  );

  // Hand the relay's palette (validated there, absent fields as null) to the
  // same helper the OSD uses, so the two can only ever pick the same color.
  const serverPalette = computed<MediaItemPalette>(() => {
    const wire = options.palette.value;
    return {
      background_dark: wire.background_dark ?? null,
      background_light: wire.background_light ?? null,
      primary: wire.primary ?? null,
      accent: wire.accent ?? null,
      on_dark: wire.on_dark ?? null,
      on_light: wire.on_light ?? null,
    };
  });

  // The theme pick mirrors Player.vue's artwork tint; a missing variant means no
  // tint rather than a stand-in color the rest of the app would never show.
  const tintColor = computed(() => {
    const { lightColor, darkColor } = paletteFromServer(serverPalette.value);
    return (useDark.value ? darkColor : lightColor) || null;
  });

  // Backgrounds stay unused here, they are not meant for the thin foreground
  // elements these colors land on.
  const paletteColors = computed<Rgb[] | null>(() => {
    if (!paletteColorsPref.value) return null;
    const wire = options.palette.value;
    const foreground = useDark.value ? wire.on_light : wire.on_dark;
    if (!foreground || !wire.primary || !wire.accent) return null;
    // waveform, outer border, inner border, motion vectors
    return [foreground, wire.primary, wire.accent, foreground];
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
    return anchors.sort((first, second) => luma(first) - luma(second));
  });

  const paletteRampStrength = computed(
    () => Math.min(Math.max(paletteRampPref.value, 0), 100) / 100,
  );

  // A whole-frame tint would flatten the preset's elements back to a single hue.
  const paletteActive = computed(
    () => options.paletteColorsSupported.value && paletteColors.value !== null,
  );

  const rampActive = computed(
    () => options.paletteRampSupported.value && paletteRamp.value !== null,
  );

  // The ramp and the element colors are the flat tint's replacement, not an
  // extra layer on top of it: they recolor by brightness and by element where
  // the tint forces one hue on everything.
  const tintForEngine = computed(() =>
    paletteActive.value || rampActive.value ? null : tintColor.value,
  );

  return {
    tintColor,
    tintForEngine,
    paletteColors,
    paletteActive,
    paletteRamp,
    paletteRampStrength,
    rampActive,
  };
}
