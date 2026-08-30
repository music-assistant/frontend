import { ref } from "vue";
import { describe, expect, it } from "vitest";
import {
  audioQualityToTier,
  QualityTier,
  qualityTierRangeLabel,
  qualityTierToColor,
  useStreamQuality,
} from "@/composables/useStreamQuality";
import { AudioQuality } from "@/plugins/api/interfaces";
import {
  audioFidelity,
  audioOutputDetails,
  audioProcessingChain,
} from "../fixtures/audioProcessing";

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
      ref(
        audioProcessingChain({
          outputs: [
            outputWithQuality(AudioQuality.STANDARD),
            outputWithQuality(AudioQuality.HI_RES),
            outputWithQuality(AudioQuality.LOW),
          ],
        }),
      ),
    );

    expect(quality.minOutputQualityTier.value).toBe(QualityTier.LOW);
    expect(quality.maxOutputQualityTier.value).toBe(QualityTier.HIRES);
  });

  it("excludes unknown qualities from the known output range", () => {
    const quality = useStreamQuality(
      ref(
        audioProcessingChain({
          outputs: [
            outputWithQuality(AudioQuality.UNKNOWN),
            outputWithQuality(AudioQuality.LOW),
            outputWithQuality(AudioQuality.HI_RES),
          ],
        }),
      ),
    );

    expect(quality.minOutputQualityTier.value).toBe(QualityTier.LOW);
    expect(quality.maxOutputQualityTier.value).toBe(QualityTier.HIRES);
    expect(
      qualityTierRangeLabel(
        quality.minOutputQualityTier.value,
        quality.maxOutputQualityTier.value,
      ),
    ).toBe("LQ-HR");
  });

  it("returns unknown for absent or empty output fidelity", () => {
    expect(useStreamQuality(ref(undefined)).minOutputQualityTier.value).toBe(
      QualityTier.UNKNOWN,
    );
    expect(
      useStreamQuality(ref(audioProcessingChain({ outputs: [] })))
        .maxOutputQualityTier.value,
    ).toBe(QualityTier.UNKNOWN);
  });

  it("falls back to the input fidelity before any output has reported one", () => {
    const quality = useStreamQuality(
      ref(
        audioProcessingChain({
          input_fidelity: audioFidelity({ quality: AudioQuality.HI_RES }),
          outputs: [],
        }),
      ),
    );

    expect(quality.minOutputQualityTier.value).toBe(QualityTier.HIRES);
    expect(quality.maxOutputQualityTier.value).toBe(QualityTier.HIRES);
  });

  it("prefers a known output quality over the input fallback", () => {
    const quality = useStreamQuality(
      ref(
        audioProcessingChain({
          input_fidelity: audioFidelity({ quality: AudioQuality.HI_RES }),
          outputs: [outputWithQuality(AudioQuality.STANDARD)],
        }),
      ),
    );

    expect(quality.minOutputQualityTier.value).toBe(QualityTier.GOOD);
    expect(quality.maxOutputQualityTier.value).toBe(QualityTier.GOOD);
  });

  it("returns unknown when all output qualities are unknown", () => {
    const quality = useStreamQuality(
      ref(
        audioProcessingChain({
          outputs: [
            outputWithQuality(AudioQuality.UNKNOWN),
            outputWithQuality("future" as AudioQuality),
            audioOutputDetails(),
          ],
        }),
      ),
    );

    expect(quality.minOutputQualityTier.value).toBe(QualityTier.UNKNOWN);
    expect(quality.maxOutputQualityTier.value).toBe(QualityTier.UNKNOWN);
  });

  it("recomputes when the embedded chain changes", () => {
    const chain = ref(
      audioProcessingChain({
        outputs: [outputWithQuality(AudioQuality.LOW)],
      }),
    );
    const quality = useStreamQuality(chain);

    expect(quality.maxOutputQualityTier.value).toBe(QualityTier.LOW);
    chain.value = audioProcessingChain({
      outputs: [outputWithQuality(AudioQuality.LOSSLESS)],
    });
    expect(quality.maxOutputQualityTier.value).toBe(QualityTier.LOSSLESS);
  });
});

function outputWithQuality(quality: AudioQuality) {
  return audioOutputDetails({ fidelity: audioFidelity({ quality }) });
}
