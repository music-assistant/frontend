import { computed, toValue, type MaybeRefOrGetter } from "vue";
import {
  type AudioFidelity,
  type AudioOutputDetails,
  AudioQuality,
} from "@/plugins/api/interfaces";

export enum QualityTier {
  UNKNOWN = 0,
  LOW = 1,
  GOOD = 2,
  LOSSLESS = 3,
  HIRES = 4,
}

export function qualityTierToColor(tier: QualityTier) {
  switch (tier) {
    case QualityTier.LOW:
      return "orange";
    case QualityTier.GOOD:
      return "lightgreen";
    case QualityTier.LOSSLESS:
      return "green";
    case QualityTier.HIRES:
      return "cyan";
    default:
      return "gray";
  }
}

export function qualityTierToLabel(tier: QualityTier) {
  switch (tier) {
    case QualityTier.LOW:
      return "LQ";
    case QualityTier.GOOD:
      return "SQ";
    case QualityTier.LOSSLESS:
      return "HQ";
    case QualityTier.HIRES:
      return "HR";
    default:
      return "";
  }
}

export function qualityTierRangeLabel(
  minimumTier: QualityTier,
  maximumTier: QualityTier,
): string {
  const maximum = qualityTierToLabel(maximumTier);
  const minimum = qualityTierToLabel(minimumTier);
  if (
    !maximum ||
    !minimum ||
    minimumTier === QualityTier.UNKNOWN ||
    minimumTier === maximumTier
  ) {
    return maximum;
  }
  return `${minimum}-${maximum}`;
}

export function audioQualityToTier(quality: AudioQuality | string | undefined) {
  switch (quality) {
    case AudioQuality.LOW:
      return QualityTier.LOW;
    case AudioQuality.STANDARD:
      return QualityTier.GOOD;
    case AudioQuality.LOSSLESS:
      return QualityTier.LOSSLESS;
    case AudioQuality.HI_RES:
      return QualityTier.HIRES;
    default:
      return QualityTier.UNKNOWN;
  }
}

// the fields either an AudioProcessingChain or an ActiveSourceAudioDetails
// snapshot carries, which is all this needs to resolve a quality tier
export interface QualityTierSource {
  input_fidelity: AudioFidelity;
  outputs: AudioOutputDetails[];
}

export function useStreamQuality(
  source: MaybeRefOrGetter<QualityTierSource | null | undefined>,
) {
  const knownOutputQualityTiers = computed(() =>
    (toValue(source)?.outputs ?? [])
      .map((output) => audioQualityToTier(output.fidelity.quality))
      .filter((tier) => tier !== QualityTier.UNKNOWN),
  );
  // before any output has reported its quality, the input's own fidelity is
  // the best signal available (e.g. a live source right as it starts)
  const inputQualityTier = computed(() =>
    audioQualityToTier(toValue(source)?.input_fidelity.quality),
  );
  const minOutputQualityTier = computed(() =>
    knownOutputQualityTiers.value.length
      ? Math.min(...knownOutputQualityTiers.value)
      : inputQualityTier.value,
  );
  const maxOutputQualityTier = computed(() =>
    knownOutputQualityTiers.value.length
      ? Math.max(...knownOutputQualityTiers.value)
      : inputQualityTier.value,
  );

  return {
    minOutputQualityTier,
    maxOutputQualityTier,
  };
}
