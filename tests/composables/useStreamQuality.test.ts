import { ref } from "vue";
import { describe, expect, it } from "vitest";
import {
  audioQualityToTier,
  QualityTier,
  qualityTierRangeLabel,
  qualityTierToColor,
  useStreamQuality,
} from "@/composables/useStreamQuality";
import {
  type AudioProcessingChain,
  AudioQuality,
} from "@/plugins/api/interfaces";

describe("stream quality presentation", () => {
  it("maps authoritative qualities, colors, and labels", () => {
    expect(audioQualityToTier(AudioQuality.STANDARD)).toBe(QualityTier.GOOD);
    expect(audioQualityToTier("future")).toBe(QualityTier.UNKNOWN);
    expect(qualityTierToColor(QualityTier.HIRES)).toBe("cyan");
    expect(qualityTierToColor(QualityTier.UNKNOWN)).toBe("gray");
    expect(qualityTierRangeLabel(QualityTier.LOW, QualityTier.HIRES)).toBe(
      "LQ-HR",
    );
    expect(
      qualityTierRangeLabel(QualityTier.LOSSLESS, QualityTier.LOSSLESS),
    ).toBe("HQ");
  });

  it("takes min and max from embedded output fidelity", () => {
    const quality = useStreamQuality(
      ref<AudioProcessingChain>({
        outputs: [
          { fidelity: { quality: AudioQuality.STANDARD } },
          { fidelity: { quality: AudioQuality.HI_RES } },
          { fidelity: { quality: AudioQuality.LOW } },
        ],
      }),
    );

    expect(quality.minOutputQualityTier.value).toBe(QualityTier.LOW);
    expect(quality.maxOutputQualityTier.value).toBe(QualityTier.HIRES);
  });

  it("returns unknown for absent, empty, or future output fidelity", () => {
    expect(useStreamQuality(ref(undefined)).minOutputQualityTier.value).toBe(
      QualityTier.UNKNOWN,
    );
    expect(
      useStreamQuality(ref<AudioProcessingChain>({ outputs: [] }))
        .maxOutputQualityTier.value,
    ).toBe(QualityTier.UNKNOWN);
    expect(
      useStreamQuality(
        ref<AudioProcessingChain>({
          outputs: [{ fidelity: { quality: "future" as AudioQuality } }],
        }),
      ).maxOutputQualityTier.value,
    ).toBe(QualityTier.UNKNOWN);
  });

  it("recomputes when the embedded chain changes", () => {
    const chain = ref<AudioProcessingChain>({
      outputs: [{ fidelity: { quality: AudioQuality.LOW } }],
    });
    const quality = useStreamQuality(chain);

    expect(quality.maxOutputQualityTier.value).toBe(QualityTier.LOW);
    chain.value = {
      outputs: [{ fidelity: { quality: AudioQuality.LOSSLESS } }],
    };
    expect(quality.maxOutputQualityTier.value).toBe(QualityTier.LOSSLESS);
  });
});
