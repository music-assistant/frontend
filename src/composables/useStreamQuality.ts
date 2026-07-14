/**
 * Derive reactive quality tiers from a processing snapshot or legacy stream details.
 *
 * The authoritative snapshot always wins when supplied.
 */

import { computed, toValue, type MaybeRefOrGetter } from "vue";
import {
  type AudioProcessingChain,
  type AudioFormat,
  AudioQuality,
  ContentType,
  type StreamDetails,
} from "@/plugins/api/interfaces";

export enum QualityTier {
  UNKNOWN = 0,
  LOW = 1,
  GOOD = 2,
  LOSSLESS = 3,
  HIRES = 4,
}

export function isPcm(contentType: ContentType) {
  return [
    ContentType.PCM_S16LE,
    ContentType.PCM_S24LE,
    ContentType.PCM_S32LE,
    ContentType.PCM_F32LE,
    ContentType.PCM_F64LE,
  ].includes(contentType);
}

export function isContentTypeLossless(contentType: ContentType) {
  if (isPcm(contentType)) return true;
  return [
    ContentType.DSF,
    ContentType.FLAC,
    ContentType.AIFF,
    ContentType.WAV,
    ContentType.ALAC,
    ContentType.WAVPACK,
    ContentType.TAK,
    ContentType.APE,
    ContentType.TRUEHD,
    ContentType.DSD_LSBF,
    ContentType.DSD_MSBF,
    ContentType.DSD_LSBF_PLANAR,
    ContentType.DSD_MSBF_PLANAR,
    ContentType.RA_144,
  ].includes(contentType);
}

export function isHiResFormat(audioFormat: AudioFormat) {
  if (
    !isContentTypeLossless(audioFormat.content_type) &&
    !isContentTypeLossless(audioFormat.codec_type)
  )
    return false;
  return audioFormat.bit_depth > 16 || audioFormat.sample_rate > 48000;
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

export function useStreamQuality(
  streamDetails: MaybeRefOrGetter<StreamDetails | undefined>,
  audioProcessingChain: MaybeRefOrGetter<
    AudioProcessingChain | undefined
  > = undefined,
) {
  const inputQualityTier = computed(() => {
    const chain = toValue(audioProcessingChain);
    if (chain) {
      return audioQualityToTier(chain.input?.fidelity?.quality);
    }

    const sd = toValue(streamDetails);
    if (!sd || sd.audio_format.content_type === ContentType.UNKNOWN)
      return QualityTier.UNKNOWN;

    // Prefer making this decision based on codec type
    const content_type = sd.audio_format.content_type;
    const codec_type = sd.audio_format.codec_type;

    if (isHiResFormat(sd.audio_format)) {
      return QualityTier.HIRES;
    } else if (
      isContentTypeLossless(content_type) ||
      isContentTypeLossless(codec_type)
    ) {
      return QualityTier.LOSSLESS;
    } else if (sd.audio_format.bit_rate >= 256) {
      return QualityTier.GOOD;
    } else {
      return QualityTier.LOW;
    }
  });

  const outputQualityTiers = computed(() => {
    const chain = toValue(audioProcessingChain);
    if (chain) {
      const tiers: Record<string, QualityTier> = {};
      for (const output of chain.outputs ?? []) {
        const tier = audioQualityToTier(output.fidelity?.quality);
        for (const playerId of output.player_ids ?? []) {
          tiers[playerId] = tier;
        }
      }
      return tiers;
    }

    const sd = toValue(streamDetails);
    const tiers: Record<string, QualityTier> = {};
    if (!sd?.dsp) {
      return tiers;
    }
    for (const [player_id, dsp] of Object.entries(sd.dsp)) {
      if (
        !dsp.output_format ||
        dsp.output_format.content_type === ContentType.UNKNOWN
      ) {
        continue;
      }
      let player_tier = QualityTier.UNKNOWN;
      if (isHiResFormat(dsp.output_format)) {
        player_tier = QualityTier.HIRES;
      } else if (
        isContentTypeLossless(dsp.output_format.content_type) ||
        isContentTypeLossless(dsp.output_format.codec_type)
      ) {
        player_tier = QualityTier.LOSSLESS;
      } else if (dsp.output_format.bit_rate >= 256) {
        player_tier = QualityTier.GOOD;
      } else {
        player_tier = QualityTier.LOW;
      }
      tiers[player_id] = player_tier;
    }
    return tiers;
  });

  const combinedOutputQualityTiers = computed(() => {
    if (toValue(audioProcessingChain)) {
      return { ...outputQualityTiers.value };
    }

    // like outputQualityTiers, but limited by the input quality
    const sd = toValue(streamDetails);
    const tiers: Record<string, QualityTier> = {};
    if (!sd?.dsp) {
      return tiers;
    }
    const inputTier = inputQualityTier.value;
    for (const player_id of Object.keys(sd.dsp)) {
      // Output quality can never be higher than input quality; players whose
      // output format is unknown/missing are absent from outputQualityTiers,
      // so fall back to UNKNOWN rather than letting Math.min produce NaN
      tiers[player_id] = Math.min(
        outputQualityTiers.value[player_id] ?? QualityTier.UNKNOWN,
        inputTier,
      );
    }
    return tiers;
  });

  const minOutputQualityTier = computed(() => {
    const chain = toValue(audioProcessingChain);
    if (chain) {
      return audioQualityToTier(chain.fidelity?.min_output_quality);
    }

    const tiers = Object.values(combinedOutputQualityTiers.value);
    return tiers.length ? Math.min(...tiers) : QualityTier.UNKNOWN;
  });

  const maxOutputQualityTier = computed(() => {
    const chain = toValue(audioProcessingChain);
    if (chain) {
      return audioQualityToTier(chain.fidelity?.max_output_quality);
    }

    const tiers = Object.values(combinedOutputQualityTiers.value);
    return tiers.length ? Math.max(...tiers) : QualityTier.UNKNOWN;
  });

  return {
    inputQualityTier,
    outputQualityTiers,
    combinedOutputQualityTiers,
    minOutputQualityTier,
    maxOutputQualityTier,
  };
}
