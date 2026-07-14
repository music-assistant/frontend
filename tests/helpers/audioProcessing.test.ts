import { describe, expect, it } from "vitest";
import { areDspDetailsEqual } from "@/helpers/audioProcessing";
import {
  ContentType,
  type DSPDetails,
  DSPState,
} from "@/plugins/api/interfaces";

describe("areDspDetailsEqual", () => {
  it("groups semantically identical details regardless of property order", () => {
    const left: DSPDetails = {
      state: DSPState.ENABLED,
      input_gain: 0,
      filters: [],
      output_gain: 0,
      output_limiter: true,
      output_format: {
        content_type: ContentType.FLAC,
        codec_type: ContentType.FLAC,
        sample_rate: 48000,
        bit_depth: 24,
        channels: 2,
        output_format_str: "first",
        bit_rate: 0,
      },
    };
    const right: DSPDetails = {
      output_limiter: true,
      output_gain: 0,
      filters: [],
      input_gain: 0,
      state: DSPState.ENABLED,
      output_format: {
        channels: 2,
        bit_depth: 24,
        sample_rate: 48000,
        codec_type: ContentType.FLAC,
        content_type: ContentType.FLAC,
        bit_rate: 0,
        output_format_str: "second",
      },
    };

    expect(areDspDetailsEqual(left, right)).toBe(true);
  });
});
