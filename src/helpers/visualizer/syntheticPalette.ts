import type { ColorPalette } from "@/plugins/visualizer-relay";

/**
 * Stand-in for an artwork palette where there is no artwork (the settings
 * preview): the OHF logo blue, run through the same palette recolouring as a
 * real track so the user's colour settings show what they do.
 */
export const SYNTHETIC_PALETTE: ColorPalette = {
  background_dark: [4, 24, 34],
  background_light: [214, 240, 251],
  // From assets/open-home-foundation-logo.svg.
  primary: [24, 188, 242],
  accent: [12, 120, 170],
  on_dark: [150, 225, 250],
  on_light: [8, 70, 100],
};
