import { describe, expect, it } from "vitest";
import { ref } from "vue";
import {
  isContentTypeLossless,
  isHiResFormat,
  isPcm,
  QualityTier,
  qualityTierToColor,
  useStreamQuality,
} from "@/composables/useStreamQuality";
import {
  type AudioFormat,
  ContentType,
  type DSPDetails,
  DSPState,
  MediaType,
  type StreamDetails,
} from "@/plugins/api/interfaces";

function makeFormat(overrides: Partial<AudioFormat> = {}): AudioFormat {
  return {
    content_type: ContentType.FLAC,
    codec_type: ContentType.FLAC,
    sample_rate: 44100,
    bit_depth: 16,
    channels: 2,
    output_format_str: "",
    bit_rate: 0,
    ...overrides,
  };
}

function makeDsp(output_format?: AudioFormat): DSPDetails {
  return {
    state: DSPState.ENABLED,
    input_gain: 0,
    filters: [],
    output_gain: 0,
    output_limiter: false,
    output_format,
  };
}

function makeStream(
  audio_format: AudioFormat,
  dsp?: Record<string, DSPDetails>,
): StreamDetails {
  return {
    provider: "test",
    item_id: "1",
    audio_format,
    media_type: MediaType.TRACK,
    dsp,
  };
}

const MP3_320 = makeFormat({
  content_type: ContentType.MP3,
  codec_type: ContentType.MP3,
  bit_rate: 320,
});
const MP3_128 = makeFormat({
  content_type: ContentType.MP3,
  codec_type: ContentType.MP3,
  bit_rate: 128,
});
const FLAC_HIRES = makeFormat({ bit_depth: 24, sample_rate: 96000 });

describe("useStreamQuality format helpers", () => {
  it("detects PCM content types", () => {
    expect(isPcm(ContentType.PCM_S24LE)).toBe(true);
    expect(isPcm(ContentType.FLAC)).toBe(false);
  });

  it("detects lossless content types", () => {
    expect(isContentTypeLossless(ContentType.FLAC)).toBe(true);
    expect(isContentTypeLossless(ContentType.PCM_S16LE)).toBe(true);
    expect(isContentTypeLossless(ContentType.MP3)).toBe(false);
  });

  it("detects hi-res only for lossless formats above CD quality", () => {
    expect(isHiResFormat(FLAC_HIRES)).toBe(true);
    expect(isHiResFormat(makeFormat())).toBe(false);
    // lossy stays false even at a high sample rate / bit depth
    expect(
      isHiResFormat(
        makeFormat({
          content_type: ContentType.MP3,
          codec_type: ContentType.MP3,
          bit_depth: 24,
          sample_rate: 96000,
        }),
      ),
    ).toBe(false);
  });

  it("maps tiers to colors with a gray fallback", () => {
    expect(qualityTierToColor(QualityTier.HIRES)).toBe("cyan");
    expect(qualityTierToColor(QualityTier.LOSSLESS)).toBe("green");
    expect(qualityTierToColor(QualityTier.GOOD)).toBe("lightgreen");
    expect(qualityTierToColor(QualityTier.LOW)).toBe("orange");
    expect(qualityTierToColor(QualityTier.UNKNOWN)).toBe("gray");
  });
});

describe("useStreamQuality input tier", () => {
  it("classifies hi-res, lossless, good and low input", () => {
    expect(
      useStreamQuality(ref(makeStream(FLAC_HIRES))).inputQualityTier.value,
    ).toBe(QualityTier.HIRES);
    expect(
      useStreamQuality(ref(makeStream(makeFormat()))).inputQualityTier.value,
    ).toBe(QualityTier.LOSSLESS);
    expect(
      useStreamQuality(ref(makeStream(MP3_320))).inputQualityTier.value,
    ).toBe(QualityTier.GOOD);
    expect(
      useStreamQuality(ref(makeStream(MP3_128))).inputQualityTier.value,
    ).toBe(QualityTier.LOW);
  });

  it("returns UNKNOWN for unknown content type or missing stream details", () => {
    expect(
      useStreamQuality(
        ref(makeStream(makeFormat({ content_type: ContentType.UNKNOWN }))),
      ).inputQualityTier.value,
    ).toBe(QualityTier.UNKNOWN);
    expect(useStreamQuality(ref(undefined)).inputQualityTier.value).toBe(
      QualityTier.UNKNOWN,
    );
  });
});

describe("useStreamQuality output tiers", () => {
  it("caps output quality at the input quality", () => {
    // input is only GOOD (mp3 320), the output would be hi-res -> capped to GOOD
    const stream = makeStream(MP3_320, { p1: makeDsp(FLAC_HIRES) });
    const {
      outputQualityTiers,
      combinedOutputQualityTiers,
      maxOutputQualityTier,
    } = useStreamQuality(ref(stream));
    expect(outputQualityTiers.value.p1).toBe(QualityTier.HIRES);
    expect(combinedOutputQualityTiers.value.p1).toBe(QualityTier.GOOD);
    expect(maxOutputQualityTier.value).toBe(QualityTier.GOOD);
  });

  it("takes the min and max across players", () => {
    const stream = makeStream(FLAC_HIRES, {
      p1: makeDsp(FLAC_HIRES),
      p2: makeDsp(MP3_128),
    });
    const { minOutputQualityTier, maxOutputQualityTier } = useStreamQuality(
      ref(stream),
    );
    expect(maxOutputQualityTier.value).toBe(QualityTier.HIRES);
    expect(minOutputQualityTier.value).toBe(QualityTier.LOW);
  });
});

describe("useStreamQuality edge cases", () => {
  it("returns UNKNOWN (never Infinity) when there are no output tiers", () => {
    const { minOutputQualityTier, maxOutputQualityTier } = useStreamQuality(
      ref(makeStream(makeFormat())),
    );
    expect(maxOutputQualityTier.value).toBe(QualityTier.UNKNOWN);
    expect(minOutputQualityTier.value).toBe(QualityTier.UNKNOWN);
    expect(Number.isFinite(maxOutputQualityTier.value)).toBe(true);
  });

  it("uses UNKNOWN (never NaN) for a player with an unknown output format", () => {
    const stream = makeStream(makeFormat(), {
      p1: makeDsp(makeFormat({ content_type: ContentType.UNKNOWN })),
    });
    const { combinedOutputQualityTiers, maxOutputQualityTier } =
      useStreamQuality(ref(stream));
    expect(combinedOutputQualityTiers.value.p1).toBe(QualityTier.UNKNOWN);
    expect(Number.isNaN(maxOutputQualityTier.value)).toBe(false);
    expect(maxOutputQualityTier.value).toBe(QualityTier.UNKNOWN);
  });
});

describe("useStreamQuality reactivity", () => {
  it("recomputes when the stream details change", () => {
    const sd = ref<StreamDetails | undefined>(makeStream(MP3_128));
    const { inputQualityTier } = useStreamQuality(sd);
    expect(inputQualityTier.value).toBe(QualityTier.LOW);
    sd.value = makeStream(FLAC_HIRES);
    expect(inputQualityTier.value).toBe(QualityTier.HIRES);
  });
});
