/**
 * The palette composable picks one side of the artwork palette per view.
 */
import { ref } from "vue";
import type { ColorPalette } from "@/plugins/visualizer-relay";
import { describe, expect, it, vi } from "vitest";

const themeDark = vi.hoisted(() => ({ value: false }));
vi.mock("@/composables/useThemePreference", () => ({
  isDark: themeDark,
}));

const prefs = vi.hoisted(
  () =>
    ({
      visualizer_palette_colors: true,
      visualizer_palette_ramp: 75,
    }) as Record<string, unknown>,
);
vi.mock("@/composables/userPreferences", () => ({
  useUserPreferences: () => ({
    getPreference: (key: string, fallback: unknown) => ({
      get value() {
        return prefs[key] ?? fallback;
      },
    }),
  }),
}));

const { useVisualizerPalette } = await import("./useVisualizerPalette");

// on_dark is the variant meant to be drawn on a dark background, so it is the
// light-looking colour; on_light is the dark-looking one.
const PALETTE: ColorPalette = {
  background_dark: [10, 10, 14],
  background_light: [245, 245, 240],
  primary: [200, 40, 40],
  accent: [40, 40, 200],
  on_dark: [235, 235, 235],
  on_light: [25, 25, 25],
};

const build = (forceDark: boolean, palette: ColorPalette = PALETTE) =>
  useVisualizerPalette({
    palette: ref(palette),
    forceDark,
  });

describe("useVisualizerPalette element colours", () => {
  it("draws the dark treatment's elements in the on-dark variant", () => {
    const { paletteColors } = build(true);
    // waveform, outer border, inner border, motion vectors
    expect(paletteColors.value).toEqual([
      [235, 235, 235],
      [200, 40, 40],
      [40, 40, 200],
      [235, 235, 235],
    ]);
  });

  it("draws the light treatment's elements in the on-light variant", () => {
    const { paletteColors } = build(false);
    expect(paletteColors.value?.[0]).toEqual([25, 25, 25]);
  });

  it("takes no colours at all when a variant is missing", () => {
    const { paletteColors } = build(true, {
      ...PALETTE,
      primary: null,
    });
    expect(paletteColors.value).toBeNull();
  });

  it("draws the inner border in primary when the artwork has no accent", () => {
    const { paletteColors } = build(true, { ...PALETTE, accent: null });
    expect(paletteColors.value?.[2]).toEqual([200, 40, 40]);
  });
});

describe("useVisualizerPalette ramp", () => {
  it("orders anchors dark to light on the dark side of the palette", () => {
    const { paletteRamp } = build(true);
    expect(paletteRamp.value).toEqual([
      [10, 10, 14],
      [40, 40, 200],
      [200, 40, 40],
      [235, 235, 235],
    ]);
  });

  it("never mixes the two contrast families into one ramp", () => {
    const { paletteRamp } = build(false);
    expect(paletteRamp.value).not.toContainEqual([10, 10, 14]);
    expect(paletteRamp.value).not.toContainEqual([235, 235, 235]);
  });

  it("scales strength out of the 0-100 preference", () => {
    const { paletteRampStrength } = build(true);
    expect(paletteRampStrength.value).toBe(0.75);
  });
});
