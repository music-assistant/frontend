import {
  type AudioDSPDetails,
  type AudioFidelity,
  type AudioNormalizationDetails,
  AudioNormalizationMeasurementSource,
  type AudioOutputDetails,
  type AudioProcessingChain,
  AudioQuality,
  type AudioQueueProcessing,
  CrossfadeMode,
  DSPState,
  VolumeNormalizationMode,
} from "@/plugins/api/interfaces";

/**
 * A complete audio fidelity, defaulting to an undetermined stream.
 */
export function audioFidelity(
  overrides: Partial<AudioFidelity> = {},
): AudioFidelity {
  return {
    quality: AudioQuality.UNKNOWN,
    bit_perfect: null,
    ...overrides,
  };
}

/**
 * Complete normalization details, defaulting to normalization turned off.
 */
export function audioNormalizationDetails(
  overrides: Partial<AudioNormalizationDetails> = {},
): AudioNormalizationDetails {
  return {
    mode: VolumeNormalizationMode.DISABLED,
    measurement_source: AudioNormalizationMeasurementSource.UNKNOWN,
    target_lufs: null,
    measured_lufs: null,
    applied_gain_db: null,
    ...overrides,
  };
}

/**
 * Complete queue processing details, defaulting to no processing applied.
 */
export function audioQueueProcessing(
  overrides: Partial<AudioQueueProcessing> = {},
): AudioQueueProcessing {
  return {
    pcm_format: null,
    normalization: null,
    playback_speed: 1,
    crossfade_mode: CrossfadeMode.DISABLED,
    overlay_active: false,
    ...overrides,
  };
}

/**
 * Complete DSP details, defaulting to DSP turned off.
 */
export function audioDSPDetails(
  overrides: Partial<AudioDSPDetails> = {},
): AudioDSPDetails {
  return {
    state: DSPState.DISABLED,
    input_gain: 0,
    filters: [],
    output_gain: 0,
    preset_id: null,
    ...overrides,
  };
}

/**
 * A complete output path, defaulting to an untouched stream to unnamed players.
 */
export function audioOutputDetails(
  overrides: Partial<AudioOutputDetails> = {},
): AudioOutputDetails {
  return {
    player_ids: [],
    dsp: audioDSPDetails(),
    source_channel: null,
    output_format: null,
    fidelity: audioFidelity(),
    ...overrides,
  };
}

/**
 * A complete processing chain, defaulting to a stream that is passed through
 * untouched and has no outputs yet.
 */
export function audioProcessingChain(
  overrides: Partial<AudioProcessingChain> = {},
): AudioProcessingChain {
  return {
    input_fidelity: audioFidelity(),
    queue_processing: null,
    outputs: [],
    ...overrides,
  };
}
