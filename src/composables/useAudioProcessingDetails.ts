import { computed, toValue, type Component, type MaybeRefOrGetter } from "vue";
import { useI18n } from "vue-i18n";
import {
  AudioLines,
  FileAudio,
  Gauge,
  GitMerge,
  Layers,
  Radio,
  Shield,
  SlidersHorizontal,
  Speaker,
  Split,
} from "@lucide/vue";
import { useDSPPresets } from "@/composables/useDSPPresets";
import {
  audioQualityToTier,
  type QualityTier,
} from "@/composables/useStreamQuality";
import { dspFilterText } from "@/helpers/audioProcessing";
import api from "@/plugins/api";
import {
  AudioChannel,
  type AudioFormat,
  type AudioNormalizationDetails,
  type AudioOutputDetails,
  type AudioProcessingChain,
  AudioQuality,
  ContentType,
  CrossfadeMode,
  DSPState,
  type StreamDetails,
  VolumeNormalizationMode,
} from "@/plugins/api/interfaces";

type TranslationValue = string | number;
type Translate = (key: string, values?: TranslationValue[]) => string;
type AudioDSPDetails = NonNullable<AudioOutputDetails["dsp"]>;

export interface AudioProcessingDisplayStage {
  key: string;
  icon: Component;
  title: string;
  subtitleParts?: string[];
  atomicSubtitleParts?: boolean;
  badge?: string;
  details?: string[];
}

export interface AudioProcessingOutputDisplay {
  key: string;
  playerIds: string[];
  qualityTier: QualityTier;
  qualityLabel: string;
  stages: AudioProcessingDisplayStage[];
  destination: AudioProcessingDisplayStage;
}

export interface AudioProcessingDetailsDisplay {
  inputQualityTier: QualityTier;
  inputQualityLabel: string;
  inputStages: AudioProcessingDisplayStage[];
  processingStages: AudioProcessingDisplayStage[];
  outputPaths: AudioProcessingOutputDisplay[];
}

export interface AudioProcessingDisplayPlayer {
  player_id: string;
  name: string;
  active_output_protocol?: string | null;
  output_protocols?: Array<{
    output_protocol_id: string;
    is_native: boolean;
  }>;
}

export interface AudioProcessingDetailsDependencies {
  translate: Translate;
  getProviderName: (providerId: string) => string;
  getPresetName: (presetId: string | null | undefined) => string | undefined;
  players: Record<string, AudioProcessingDisplayPlayer>;
}

const KNOWN_CONTENT_TYPES = new Set<string>(Object.values(ContentType));
const PCM_CONTENT_TYPES = new Set<string>([
  ContentType.PCM_S16LE,
  ContentType.PCM_S24LE,
  ContentType.PCM_S32LE,
  ContentType.PCM_F32LE,
  ContentType.PCM_F64LE,
  ContentType.PCM_S16BE,
  ContentType.PCM_S24BE,
  ContentType.PCM_S32BE,
  ContentType.PCM_BLURAY,
  ContentType.PCM_DVD,
]);
const FLOAT_PCM_CONTENT_TYPES = new Set<string>([
  ContentType.PCM_F32LE,
  ContentType.PCM_F64LE,
]);
const LOSSY_AUDIO_CODECS = new Set<string>([
  ContentType.AAC,
  ContentType.AC3,
  ContentType.ADPCM_IMA,
  ContentType.ADPCM_MS,
  ContentType.ADPCM_SWF,
  ContentType.AMR,
  ContentType.AMR_WB,
  ContentType.ATRAC3,
  ContentType.COOK,
  ContentType.DRA,
  ContentType.DTS,
  ContentType.EAC3,
  ContentType.G722,
  ContentType.G726,
  ContentType.MP1,
  ContentType.MP2,
  ContentType.MP3,
  ContentType.MUSEPACK,
  ContentType.OPUS,
  ContentType.PCM_ALAW,
  ContentType.PCM_MULAW,
  ContentType.SPEEX,
  ContentType.VORBIS,
  ContentType.WMA,
  ContentType.WMAPRO,
  ContentType.WMAV2,
]);

export function useAudioProcessingDetails(
  chain: MaybeRefOrGetter<AudioProcessingChain>,
  streamDetails: MaybeRefOrGetter<StreamDetails>,
) {
  const { t, locale } = useI18n({ useScope: "global" });
  const { getPresetName } = useDSPPresets({ optional: true });
  const translate: Translate = (key, values) =>
    values ? t(key, values) : t(key);
  const display = computed(() => {
    void locale.value;
    return buildAudioProcessingDetailsDisplay(
      toValue(chain),
      toValue(streamDetails),
      {
        translate,
        getProviderName: (providerId) => api.getProviderName(providerId),
        getPresetName,
        players: api.players,
      },
    );
  });

  return {
    inputQualityTier: computed(() => display.value.inputQualityTier),
    inputQualityLabel: computed(() => display.value.inputQualityLabel),
    inputStages: computed(() => display.value.inputStages),
    processingStages: computed(() => display.value.processingStages),
    outputPaths: computed(() => display.value.outputPaths),
  };
}

export function buildAudioProcessingDetailsDisplay(
  chain: AudioProcessingChain,
  streamDetails: StreamDetails,
  dependencies: AudioProcessingDetailsDependencies,
): AudioProcessingDetailsDisplay {
  return {
    inputQualityTier: audioQualityToTier(chain.input_fidelity?.quality),
    inputQualityLabel: audioQualityLabel(
      chain.input_fidelity?.quality,
      dependencies.translate,
    ),
    inputStages: buildInputStages(streamDetails, dependencies),
    processingStages: buildProcessingStages(streamDetails, chain, dependencies),
    outputPaths: (chain.outputs ?? []).map((output, index) =>
      buildOutputDisplay(output, index, dependencies),
    ),
  };
}

function buildInputStages(
  streamDetails: StreamDetails,
  dependencies: AudioProcessingDetailsDependencies,
): AudioProcessingDisplayStage[] {
  return [
    {
      key: "provider",
      icon: Radio,
      title: dependencies.getProviderName(streamDetails.provider),
    },
    formatStage(
      "source-format",
      streamDetails.audio_format,
      dependencies.translate,
    ),
  ];
}

function buildProcessingStages(
  streamDetails: StreamDetails,
  chain: AudioProcessingChain,
  dependencies: AudioProcessingDetailsDependencies,
): AudioProcessingDisplayStage[] {
  const { translate } = dependencies;
  const stages: AudioProcessingDisplayStage[] = [];
  const processing = chain.queue_processing;
  if (
    processing?.normalization &&
    processing.normalization.mode !== VolumeNormalizationMode.DISABLED
  ) {
    stages.push(normalizationStage(processing.normalization, translate));
  }
  if (
    typeof processing?.playback_speed === "number" &&
    processing.playback_speed !== 1
  ) {
    stages.push({
      key: "playback-speed",
      icon: Gauge,
      title: translate("streamdetails.audio_processing.playback_speed", [
        formatNumber(processing.playback_speed, 2),
      ]),
    });
  }
  if (
    processing?.crossfade_mode &&
    processing.crossfade_mode !== CrossfadeMode.DISABLED
  ) {
    stages.push({
      key: "crossfade",
      icon: GitMerge,
      title: translate("streamdetails.audio_processing.crossfade", [
        crossfadeModeLabel(processing.crossfade_mode, translate),
      ]),
    });
  }
  if (processing?.overlay_active) {
    stages.push({
      key: "overlay",
      icon: Layers,
      title: translate("streamdetails.audio_processing.overlay_active"),
    });
  }
  if (processing?.pcm_format) {
    const contextStage = processingContextStage(
      streamDetails.audio_format,
      processing.pcm_format,
      chain,
      stages.length === 0,
      translate,
    );
    if (contextStage) stages.unshift(contextStage);
  }
  return stages;
}

function buildOutputDisplay(
  output: AudioOutputDetails,
  index: number,
  dependencies: AudioProcessingDetailsDependencies,
): AudioProcessingOutputDisplay {
  const { translate, getPresetName } = dependencies;
  const playerIds = output.player_ids ?? [];
  const stages: AudioProcessingDisplayStage[] = [];

  if (output.dsp) {
    if (shouldShowDSPState(output.dsp)) {
      stages.push({
        key: `dsp-state-${index}`,
        icon: SlidersHorizontal,
        title: dspStateLabel(output.dsp.state, translate),
      });
    }
    if (output.dsp.preset_id) {
      stages.push({
        key: `dsp-preset-${index}`,
        icon: SlidersHorizontal,
        title:
          getPresetName(output.dsp.preset_id) ??
          translate("settings.dsp.presets.custom"),
        subtitleParts: [
          translate("streamdetails.audio_processing.dsp_preset_label"),
        ],
      });
    }
    if (output.dsp.input_gain) {
      stages.push({
        key: `dsp-input-gain-${index}`,
        icon: SlidersHorizontal,
        title: translate("streamdetails.input_gain", [
          formatNumber(output.dsp.input_gain),
        ]),
      });
    }
    for (const [filterIndex, filter] of (output.dsp.filters ?? []).entries()) {
      stages.push({
        key: `dsp-filter-${index}-${filterIndex}`,
        icon: SlidersHorizontal,
        title: dspFilterText(filter),
      });
    }
    if (output.dsp.output_gain) {
      stages.push({
        key: `dsp-output-gain-${index}`,
        icon: SlidersHorizontal,
        title: translate("streamdetails.output_gain", [
          formatNumber(output.dsp.output_gain),
        ]),
      });
    }
  }

  if (output.source_channel) {
    stages.push({
      key: `source-channel-${index}`,
      icon: Split,
      title: translate("streamdetails.audio_processing.source_channel", [
        sourceChannelLabel(output.source_channel, translate),
      ]),
    });
  }
  if (output.dsp?.output_limiter) {
    stages.push({
      key: `output-limiter-${index}`,
      icon: Shield,
      title: translate("streamdetails.output_limiter"),
    });
  }
  stages.push(finalOutputStage(output, index, translate));

  return {
    key: playerIds.join("|") || `output-${index}`,
    playerIds,
    qualityTier: audioQualityToTier(output.fidelity?.quality),
    qualityLabel: audioQualityLabel(output.fidelity?.quality, translate),
    stages,
    destination: destinationStage(playerIds, dependencies),
  };
}

function destinationStage(
  playerIds: string[],
  dependencies: AudioProcessingDetailsDependencies,
): AudioProcessingDisplayStage {
  if (playerIds.length === 0) {
    return {
      key: "destination",
      icon: Speaker,
      title: dependencies.translate(
        "streamdetails.audio_processing.destination_unavailable",
      ),
    };
  }
  const destinations = resolveDestinations(playerIds, dependencies);
  const primary = destinations[0];
  const additionalDestinationCount = destinations.length - 1;
  return {
    key: "destination",
    icon: Speaker,
    title:
      additionalDestinationCount > 0
        ? `${primary.name} +${additionalDestinationCount}`
        : primary.name,
    details:
      additionalDestinationCount > 0
        ? destinations.map((destination) => destination.name)
        : undefined,
  };
}

function resolveDestinations(
  playerIds: string[],
  dependencies: AudioProcessingDetailsDependencies,
): Array<{ playerId: string; name: string }> {
  const destinations: Array<{ playerId: string; name: string }> = [];
  const seenPlayerIds = new Set<string>();
  for (const playerId of playerIds) {
    const player = resolveDestinationPlayer(playerId, dependencies.players);
    const resolvedPlayerId = player?.player_id ?? playerId;
    if (seenPlayerIds.has(resolvedPlayerId)) continue;
    seenPlayerIds.add(resolvedPlayerId);
    destinations.push({
      playerId: resolvedPlayerId,
      name:
        player?.name ??
        dependencies.translate(
          "streamdetails.audio_processing.destination_unknown",
          [playerId],
        ),
    });
  }
  return destinations;
}

function resolveDestinationPlayer(
  playerId: string,
  players: Record<string, AudioProcessingDisplayPlayer>,
): AudioProcessingDisplayPlayer | undefined {
  const protocolParent = Object.values(players).find(
    (player) =>
      player.player_id !== playerId &&
      (player.active_output_protocol === playerId ||
        player.output_protocols?.some(
          (protocol) =>
            !protocol.is_native && protocol.output_protocol_id === playerId,
        )),
  );
  return protocolParent ?? players[playerId];
}

function normalizationStage(
  normalization: AudioNormalizationDetails,
  translate: Translate,
): AudioProcessingDisplayStage {
  const details: string[] = [
    translate("streamdetails.audio_processing.measurement_source", [
      measurementSourceLabel(normalization.measurement_source, translate),
    ]),
  ];
  addDetail(
    details,
    "streamdetails.audio_processing.target_lufs",
    normalization.target_lufs,
    translate,
  );
  addDetail(
    details,
    "streamdetails.audio_processing.measured_lufs",
    normalization.measured_lufs,
    translate,
  );
  addDetail(
    details,
    "streamdetails.audio_processing.applied_gain_db",
    normalization.applied_gain_db,
    translate,
  );
  return {
    key: "normalization",
    icon: AudioLines,
    title: translate("streamdetails.audio_processing.normalization_title"),
    subtitleParts: [normalizationModeLabel(normalization.mode, translate)],
    details,
  };
}

function processingContextStage(
  sourceFormat: AudioFormat,
  internalFormat: AudioFormat,
  chain: AudioProcessingChain,
  sharedPathIsDirect: boolean,
  translate: Translate,
): AudioProcessingDisplayStage | undefined {
  const internalCodec = audioFormatCodec(internalFormat);
  const internalFormatDetail = translate(
    "streamdetails.audio_processing.internal_format_detail",
    [internalFormatSummary(internalFormat, translate)],
  );

  if (
    FLOAT_PCM_CONTENT_TYPES.has(internalCodec) &&
    !FLOAT_PCM_CONTENT_TYPES.has(audioFormatCodec(sourceFormat))
  ) {
    const details = [
      translate("streamdetails.audio_processing.processing_headroom_detail"),
      internalFormatDetail,
    ];
    const reasons = processingHeadroomReasons(chain, translate);
    if (reasons.length > 0) {
      details.push(
        translate(
          "streamdetails.audio_processing.processing_headroom_reasons",
          [reasons.join(", ")],
        ),
      );
    }
    return {
      key: "pcm-format",
      icon: FileAudio,
      title: translate("streamdetails.audio_processing.processing_headroom"),
      subtitleParts: [contentTypeLabel(internalCodec, translate)],
      atomicSubtitleParts: true,
      details,
    };
  }

  if (
    sharedPathIsDirect &&
    !hasMeaningfulInternalConversion(sourceFormat, internalFormat)
  ) {
    if (!allOutputsAreBitPerfect(chain)) {
      return {
        key: "pcm-format",
        icon: FileAudio,
        title: translate("streamdetails.audio_processing.no_shared_transforms"),
        details: [
          translate(
            "streamdetails.audio_processing.no_shared_transforms_detail",
          ),
          internalFormatDetail,
        ],
      };
    }
    return {
      key: "pcm-format",
      icon: FileAudio,
      title: translate("streamdetails.audio_processing.direct_signal_path"),
      details: [
        translate("streamdetails.audio_processing.direct_signal_path_detail"),
        internalFormatDetail,
        translate(
          "streamdetails.audio_processing.direct_signal_path_inactive_detail",
        ),
      ],
    };
  }

  if (hasMeaningfulInternalConversion(sourceFormat, internalFormat)) {
    return {
      key: "pcm-format",
      icon: FileAudio,
      title: translate(
        "streamdetails.audio_processing.internal_format_conversion",
      ),
      subtitleParts: [internalFormatPrimaryLabel(internalFormat, translate)],
      atomicSubtitleParts: true,
      details: [
        translate(
          "streamdetails.audio_processing.internal_format_conversion_detail",
        ),
        internalFormatDetail,
      ],
    };
  }
  return undefined;
}

function allOutputsAreBitPerfect(chain: AudioProcessingChain): boolean {
  return Boolean(
    chain.outputs?.length &&
    chain.outputs.every((output) => output.fidelity?.bit_perfect === true),
  );
}

function finalOutputStage(
  output: AudioOutputDetails,
  index: number,
  translate: Translate,
): AudioProcessingDisplayStage {
  const format = output.output_format;
  const details = format ? audioFormatDetails(format, translate) : [];
  details.push(
    outputFidelityDetail(
      output.fidelity?.bit_perfect,
      output.output_format,
      translate,
    ),
  );
  return {
    key: `output-format-${index}`,
    icon: FileAudio,
    title: format
      ? audioFormatTitle(format, translate)
      : translate("streamdetails.audio_processing.unknown_format"),
    subtitleParts: format
      ? audioFormatTechnicalParts(format, translate)
      : undefined,
    atomicSubtitleParts: true,
    badge:
      output.fidelity?.bit_perfect === true
        ? translate("streamdetails.audio_processing.bit_perfect_badge")
        : undefined,
    details,
  };
}

function formatStage(
  key: string,
  format: AudioFormat,
  translate: Translate,
): AudioProcessingDisplayStage {
  return {
    key,
    icon: FileAudio,
    title: audioFormatTitle(format, translate),
    subtitleParts: audioFormatTechnicalParts(format, translate),
    atomicSubtitleParts: true,
    details: audioFormatDetails(format, translate),
  };
}

function outputFidelityDetail(
  bitPerfect: boolean | null | undefined,
  format: AudioFormat | null | undefined,
  translate: Translate,
): string {
  if (bitPerfect === true) {
    return translate("streamdetails.audio_processing.bit_perfect_detail");
  }
  if (bitPerfect === false) {
    if (format && LOSSY_AUDIO_CODECS.has(audioFormatCodec(format))) {
      return translate("streamdetails.audio_processing.lossy_output_detail");
    }
    return translate("streamdetails.audio_processing.samples_changed_detail");
  }
  return translate("streamdetails.audio_processing.bit_perfect_unknown_detail");
}

function shouldShowDSPState(dsp: AudioDSPDetails): boolean {
  return dsp.state !== DSPState.DISABLED || hasDSPConfiguration(dsp);
}

function hasDSPConfiguration(dsp: AudioDSPDetails): boolean {
  return Boolean(
    dsp.preset_id || dsp.input_gain || dsp.output_gain || dsp.filters?.length,
  );
}

function hasActiveDSPTransform(dsp: AudioDSPDetails): boolean {
  return Boolean(
    dsp.state === DSPState.ENABLED &&
    (dsp.preset_id ||
      dsp.input_gain ||
      dsp.output_gain ||
      dsp.filters?.some((filter) => filter.enabled !== false)),
  );
}

function processingHeadroomReasons(
  chain: AudioProcessingChain,
  translate: Translate,
): string[] {
  const reasons = new Set<string>();
  const processing = chain.queue_processing;
  if (
    processing?.normalization &&
    processing.normalization.mode !== VolumeNormalizationMode.DISABLED
  ) {
    reasons.add(
      translate("streamdetails.audio_processing.normalization_title"),
    );
  }
  if (
    typeof processing?.playback_speed === "number" &&
    processing.playback_speed !== 1
  ) {
    reasons.add(
      translate("streamdetails.audio_processing.playback_speed_title"),
    );
  }
  if (
    processing?.crossfade_mode === CrossfadeMode.SMART_CROSSFADE ||
    processing?.crossfade_mode === CrossfadeMode.STANDARD_CROSSFADE
  ) {
    reasons.add(translate("streamdetails.audio_processing.crossfade_title"));
  }
  if (processing?.overlay_active) {
    reasons.add(translate("streamdetails.audio_processing.overlay_title"));
  }
  for (const output of chain.outputs ?? []) {
    if (!output.dsp) continue;
    if (hasActiveDSPTransform(output.dsp)) {
      reasons.add(translate("streamdetails.audio_processing.dsp_title"));
    }
    if (output.dsp.output_limiter) {
      reasons.add(translate("streamdetails.output_limiter"));
    }
  }
  return [...reasons];
}

function addDetail(
  details: string[],
  key: string,
  value: number | null | undefined,
  translate: Translate,
): void {
  if (typeof value === "number") {
    details.push(translate(key, [formatNumber(value, 2)]));
  }
}

function audioFormatTitle(format: AudioFormat, translate: Translate): string {
  return contentTypeLabel(audioFormatCodec(format), translate);
}

function audioFormatTechnicalParts(
  format: AudioFormat,
  translate: Translate,
): string[] {
  const codec = audioFormatCodec(format);
  const parts: string[] = [];
  if (format.sample_rate > 0) {
    parts.push(
      translate("streamdetails.audio_processing.sample_rate", [
        formatNumber(format.sample_rate / 1000, 1),
      ]),
    );
  }
  if (format.bit_depth > 0 && !FLOAT_PCM_CONTENT_TYPES.has(codec)) {
    parts.push(
      translate("streamdetails.audio_processing.bit_depth", [format.bit_depth]),
    );
  }
  if (format.channels > 0) {
    parts.push(audioChannelCountLabel(format.channels, translate));
  }
  if (format.bit_rate > 0 && !PCM_CONTENT_TYPES.has(codec)) {
    parts.push(
      translate("streamdetails.audio_processing.bit_rate", [
        formatNumber(format.bit_rate),
      ]),
    );
  }
  return parts;
}

function internalFormatPrimaryLabel(
  format: AudioFormat,
  translate: Translate,
): string {
  const codec = audioFormatCodec(format);
  if (
    PCM_CONTENT_TYPES.has(codec) &&
    !FLOAT_PCM_CONTENT_TYPES.has(codec) &&
    format.bit_depth > 0
  ) {
    return translate("streamdetails.audio_processing.integer_pcm", [
      format.bit_depth,
    ]);
  }
  return contentTypeLabel(codec, translate);
}

function internalFormatSummary(
  format: AudioFormat,
  translate: Translate,
): string {
  const codec = audioFormatCodec(format);
  const parts = [internalFormatPrimaryLabel(format, translate)];
  if (!PCM_CONTENT_TYPES.has(codec) && format.bit_depth > 0) {
    parts.push(
      translate("streamdetails.audio_processing.bit_depth", [format.bit_depth]),
    );
  }
  if (format.sample_rate > 0) {
    parts.push(
      translate("streamdetails.audio_processing.sample_rate", [
        formatNumber(format.sample_rate / 1000, 1),
      ]),
    );
  }
  if (format.channels > 0) {
    parts.push(audioChannelCountLabel(format.channels, translate));
  }
  return parts.join(" · ");
}

function hasMeaningfulInternalConversion(
  sourceFormat: AudioFormat,
  internalFormat: AudioFormat,
): boolean {
  if (
    formatValueDiffers(sourceFormat.sample_rate, internalFormat.sample_rate) ||
    formatValueDiffers(sourceFormat.bit_depth, internalFormat.bit_depth) ||
    formatValueDiffers(sourceFormat.channels, internalFormat.channels)
  ) {
    return true;
  }
  const sourceCodec = audioFormatCodec(sourceFormat);
  const internalCodec = audioFormatCodec(internalFormat);
  return (
    PCM_CONTENT_TYPES.has(sourceCodec) &&
    PCM_CONTENT_TYPES.has(internalCodec) &&
    sourceCodec !== internalCodec
  );
}

function formatValueDiffers(
  sourceValue: number,
  internalValue: number,
): boolean {
  return sourceValue > 0 && internalValue > 0 && sourceValue !== internalValue;
}

function audioFormatCodec(format: AudioFormat): string {
  return format.codec_type && format.codec_type !== ContentType.UNKNOWN
    ? format.codec_type
    : format.content_type;
}

function audioChannelCountLabel(
  channels: number,
  translate: Translate,
): string {
  if (channels === 1) {
    return translate("streamdetails.audio_processing.mono");
  }
  if (channels === 2) {
    return translate("streamdetails.audio_processing.stereo");
  }
  return translate("streamdetails.audio_processing.channel_count", [channels]);
}

function audioFormatDetails(
  format: AudioFormat,
  translate: Translate,
): string[] {
  const details = [
    translate("streamdetails.file_info.container", [
      contentTypeLabel(format.content_type, translate),
    ]),
  ];
  if (format.codec_type && format.codec_type !== ContentType.UNKNOWN) {
    details.push(
      translate("streamdetails.file_info.codec", [
        contentTypeLabel(format.codec_type, translate),
      ]),
    );
  }
  if (format.bit_depth > 0) {
    details.push(
      translate("streamdetails.file_info.bit_depth", [format.bit_depth]),
    );
  }
  if (format.sample_rate > 0) {
    details.push(
      translate("streamdetails.file_info.sample_rate", [
        formatNumber(format.sample_rate / 1000, 1),
      ]),
    );
  }
  if (format.channels > 0) {
    details.push(
      translate("streamdetails.file_info.channels", [format.channels]),
    );
  }
  if (format.bit_rate > 0) {
    details.push(
      translate("streamdetails.file_info.bit_rate", [
        formatNumber(format.bit_rate),
      ]),
    );
  }
  return details;
}

function contentTypeLabel(
  contentType: string | undefined,
  translate: Translate,
): string {
  if (
    !contentType ||
    contentType === ContentType.UNKNOWN ||
    !KNOWN_CONTENT_TYPES.has(contentType)
  ) {
    return translate("streamdetails.audio_processing.unknown_format");
  }
  if (contentType === ContentType.PCM_F32LE) {
    return translate("streamdetails.audio_processing.float_pcm_32");
  }
  if (contentType === ContentType.PCM_F64LE) {
    return translate("streamdetails.audio_processing.float_pcm_64");
  }
  if (PCM_CONTENT_TYPES.has(contentType)) {
    return translate("streamdetails.audio_processing.pcm");
  }
  return contentType.toUpperCase();
}

function audioQualityLabel(
  quality: string | undefined,
  translate: Translate,
): string {
  switch (quality) {
    case AudioQuality.LOW:
      return translate("streamdetails.audio_processing.quality.low");
    case AudioQuality.STANDARD:
      return translate("streamdetails.audio_processing.quality.standard");
    case AudioQuality.LOSSLESS:
      return translate("streamdetails.audio_processing.quality.lossless");
    case AudioQuality.HI_RES:
      return translate("streamdetails.audio_processing.quality.hi_res");
    default:
      return translate("streamdetails.audio_processing.quality.unknown");
  }
}

function normalizationModeLabel(
  mode: string | undefined,
  translate: Translate,
): string {
  switch (mode) {
    case VolumeNormalizationMode.DISABLED:
      return translate(
        "streamdetails.audio_processing.normalization_mode.disabled",
      );
    case VolumeNormalizationMode.DYNAMIC:
      return translate(
        "streamdetails.audio_processing.normalization_mode.dynamic",
      );
    case VolumeNormalizationMode.MEASUREMENT_ONLY:
      return translate(
        "streamdetails.audio_processing.normalization_mode.measurement_only",
      );
    case VolumeNormalizationMode.FALLBACK_FIXED_GAIN:
      return translate(
        "streamdetails.audio_processing.normalization_mode.fallback_fixed_gain",
      );
    case VolumeNormalizationMode.FIXED_GAIN:
      return translate(
        "streamdetails.audio_processing.normalization_mode.fixed_gain",
      );
    case VolumeNormalizationMode.FALLBACK_DYNAMIC:
      return translate(
        "streamdetails.audio_processing.normalization_mode.fallback_dynamic",
      );
    default:
      return translate("streamdetails.audio_processing.unknown");
  }
}

function measurementSourceLabel(
  source: string | undefined,
  translate: Translate,
): string {
  const knownSources = ["track", "album", "live", "fallback"];
  if (!source || !knownSources.includes(source)) {
    return translate("streamdetails.audio_processing.unknown");
  }
  return translate(`streamdetails.audio_processing.measurement.${source}`);
}

function crossfadeModeLabel(mode: string, translate: Translate): string {
  switch (mode) {
    case CrossfadeMode.SMART_CROSSFADE:
      return translate("streamdetails.audio_processing.crossfade_mode.smart");
    case CrossfadeMode.STANDARD_CROSSFADE:
      return translate(
        "streamdetails.audio_processing.crossfade_mode.standard",
      );
    case CrossfadeMode.DISABLED:
      return translate(
        "streamdetails.audio_processing.crossfade_mode.disabled",
      );
    default:
      return translate("streamdetails.audio_processing.unknown");
  }
}

function dspStateLabel(
  state: string | undefined,
  translate: Translate,
): string {
  switch (state) {
    case DSPState.ENABLED:
      return translate("streamdetails.audio_processing.dsp_state.enabled");
    case DSPState.DISABLED:
      return translate("streamdetails.audio_processing.dsp_state.disabled");
    case DSPState.DISABLED_BY_UNSUPPORTED_GROUP:
      return translate(
        "streamdetails.audio_processing.dsp_state.disabled_by_unsupported_group",
      );
    default:
      return translate("streamdetails.audio_processing.dsp_state.unknown");
  }
}

function sourceChannelLabel(channel: string, translate: Translate): string {
  switch (channel) {
    case AudioChannel.FL:
      return translate("streamdetails.audio_processing.source_channel_left");
    case AudioChannel.FR:
      return translate("streamdetails.audio_processing.source_channel_right");
    default:
      return translate("streamdetails.audio_processing.unknown");
  }
}

function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
  }).format(value);
}
