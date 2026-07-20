import { describe, expect, it } from "vitest";
import { reactive } from "vue";
import {
  areDSPConfigsEqual,
  sanitizeDSPPresetConfig,
} from "@/helpers/audioProcessing";
import { type DSPConfig, DSPFilterType } from "@/plugins/api/interfaces";

describe("sanitizeDSPPresetConfig", () => {
  it("strips preset identity from a deep copy", () => {
    const config: DSPConfig = {
      enabled: true,
      filters: [
        {
          type: DSPFilterType.TONE_CONTROL,
          enabled: true,
          bass_level: 1,
          mid_level: 2,
          treble_level: 3,
        },
      ],
      input_gain: 1,
      output_gain: 2,
      preset_id: "preset-1",
    };

    const sanitized = sanitizeDSPPresetConfig(reactive(config));
    sanitized.filters[0].enabled = false;

    expect(sanitized.preset_id).toBeNull();
    expect(sanitized).not.toBe(config);
    expect(sanitized.filters).not.toBe(config.filters);
    expect(config.filters[0].enabled).toBe(true);
  });

  describe("areDSPConfigsEqual", () => {
    it("compares released gain and balance filters", () => {
      const left: DSPConfig = {
        enabled: true,
        filters: [
          {
            type: DSPFilterType.GAIN,
            enabled: true,
            gain: 2,
          },
          {
            type: DSPFilterType.BALANCE,
            enabled: true,
            balance: -25,
          },
        ],
        input_gain: 0,
        output_gain: 0,
        preset_id: null,
      };
      const right = structuredClone(left);

      expect(areDSPConfigsEqual(left, right)).toBe(true);
      right.filters[1].enabled = false;
      expect(areDSPConfigsEqual(left, right)).toBe(false);
    });
  });
});
