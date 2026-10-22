import { CompressorFilter } from "@/plugins/api/interfaces";

export type CompressorPresetKey = "light" | "medium" | "heavy";

// The six values the model stores for a compressor.
export type CompressorParams = Pick<
  CompressorFilter,
  "threshold" | "ratio" | "attack" | "release" | "knee" | "makeup"
>;

// Presets exist only in the frontend; the model/API only ever see the six
// numbers. Light intentionally equals the model defaults, so a freshly added
// compressor reverse-matches to Light and opens in Basic mode.
export const COMPRESSOR_PRESETS: Record<CompressorPresetKey, CompressorParams> =
  {
    light: {
      threshold: -18,
      ratio: 2.0,
      attack: 20,
      release: 250,
      knee: 9,
      makeup: 0,
    },
    medium: {
      threshold: -24,
      ratio: 3.0,
      attack: 15,
      release: 200,
      knee: 6,
      makeup: 3,
    },
    heavy: {
      threshold: -30,
      ratio: 6.0,
      attack: 5,
      release: 150,
      knee: 3,
      makeup: 6,
    },
  };

export const COMPRESSOR_PRESET_KEYS = Object.keys(
  COMPRESSOR_PRESETS,
) as CompressorPresetKey[];

const PRESET_FIELDS: (keyof CompressorParams)[] = [
  "threshold",
  "ratio",
  "attack",
  "release",
  "knee",
  "makeup",
];

// Reverse-match the stored values against the known presets. There is no marker
// field in the model, so the mode is inferred: an exact match means Basic with
// that preset highlighted; anything else means Advanced.
export const matchCompressorPreset = (
  params: CompressorParams,
): CompressorPresetKey | null => {
  for (const key of COMPRESSOR_PRESET_KEYS) {
    const preset = COMPRESSOR_PRESETS[key];
    if (PRESET_FIELDS.every((f) => Math.abs(params[f] - preset[f]) < 1e-6)) {
      return key;
    }
  }
  return null;
};
