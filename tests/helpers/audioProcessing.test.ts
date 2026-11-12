import { describe, expect, it } from "vitest";
import { reactive } from "vue";
import {
  areDSPConfigsEqual,
  areDSPSettingsEqual,
  dspFilterPosition,
  parseDSPStage,
  sanitizeDSPPresetConfig,
} from "@/helpers/audioProcessing";
import {
  type DSPConfig,
  type DSPFilter,
  DSPFilterType,
} from "@/plugins/api/interfaces";

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

  describe("areDSPSettingsEqual", () => {
    it("ignores the DSP on/off state and preset selection", () => {
      const left: DSPConfig = {
        enabled: true,
        filters: [{ type: DSPFilterType.GAIN, enabled: true, gain: 2 }],
        input_gain: 0,
        output_gain: 0,
        preset_id: "warm",
      };
      const right = structuredClone(left);
      right.enabled = false;
      right.preset_id = null;

      expect(areDSPSettingsEqual(left, right)).toBe(true);
      expect(areDSPConfigsEqual(left, right)).toBe(false);
      right.input_gain = -3;
      expect(areDSPSettingsEqual(left, right)).toBe(false);
    });
  });
});

const peq = (preamp: number): DSPFilter => ({
  type: DSPFilterType.PARAMETRIC_EQ,
  enabled: true,
  preamp,
  per_channel_preamp: {},
  bands: [],
});

describe("dspFilterPosition", () => {
  it("finds a filter past the ones the signal path leaves out", () => {
    const filters: DSPFilter[] = [
      { type: DSPFilterType.BALANCE, enabled: true, balance: 0 },
      { type: DSPFilterType.GAIN, enabled: false, gain: 3 },
      peq(-2),
    ];

    expect(dspFilterPosition(filters, peq(-2), 0)).toBe(2);
  });

  it("matches identical filters by how many came before", () => {
    const filters = [peq(-2), peq(-1), peq(-2)];

    expect(dspFilterPosition(filters, peq(-2), 0)).toBe(0);
    expect(dspFilterPosition(filters, peq(-2), 1)).toBe(2);
  });

  it("finds nothing once the filter has changed", () => {
    expect(dspFilterPosition([peq(-2)], peq(-3), 0)).toBeUndefined();
    expect(dspFilterPosition([peq(-2)], peq(-2), 1)).toBeUndefined();
  });
});

describe("parseDSPStage", () => {
  it.each([
    ["input", "input"],
    ["output", "output"],
    ["1", 1],
  ])("reads %s", (value, expected) => {
    expect(parseDSPStage(value, 2)).toBe(expected);
  });

  it.each([undefined, "2", "-1", "1.5", "eq", ["1"]])("ignores %s", (value) => {
    expect(parseDSPStage(value, 2)).toBeUndefined();
  });
});
