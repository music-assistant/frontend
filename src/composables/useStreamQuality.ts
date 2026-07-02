/**
 * Reactive stream-quality tiers derived from a queue item's stream details.
 *
 * Shared by the quality trigger button (which shows the highest output tier as
 * a short label and colour) and the audio signal-chain diagram (which shows the
 * input tier and the per-player output tiers). Pass the stream details as a ref
 * or getter; every tier recomputes when it changes.
 */

import { computed, toValue, type MaybeRefOrGetter } from "vue";
import {
  type AudioFormat,
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

export function useStreamQuality(
  streamDetails: MaybeRefOrGetter<StreamDetails | undefined>,
) {
  const inputQualityTier = computed(() => {
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
    // like outputQualityTiers, but limited by the input quality
    const sd = toValue(streamDetails);
    const tiers: Record<string, QualityTier> = {};
    if (!sd?.dsp) {
      return tiers;
    }
    const inputTier = inputQualityTier.value;
    for (const player_id of Object.keys(sd.dsp)) {
      // Output quality can never be higher than input quality
      tiers[player_id] = Math.min(
        outputQualityTiers.value[player_id],
        inputTier,
      );
    }
    return tiers;
  });

  const minOutputQualityTier = computed(() => {
    return Math.min(...Object.values(combinedOutputQualityTiers.value));
  });

  const maxOutputQualityTier = computed(() => {
    return Math.max(...Object.values(combinedOutputQualityTiers.value));
  });

  return {
    inputQualityTier,
    outputQualityTiers,
    combinedOutputQualityTiers,
    minOutputQualityTier,
    maxOutputQualityTier,
  };
}
