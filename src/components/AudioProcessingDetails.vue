<template>
  <div class="audio-processing-details" data-testid="audio-processing-details">
    <section
      class="audio-processing-group"
      data-section="input"
      data-testid="audio-input-path"
    >
      <div class="audio-processing-header">
        <span
          class="audio-processing-quality-dot"
          :style="{ backgroundColor: qualityTierToColor(inputQualityTier) }"
        ></span>
        <span class="audio-processing-header-title">
          {{ $t("streamdetails.input_header") }}
        </span>
        <span class="audio-processing-header-meta">
          {{ inputQualityLabel }}
        </span>
        <span class="audio-processing-header-rule" aria-hidden="true"></span>
      </div>

      <div class="audio-processing-section">
        <AudioProcessingStage
          v-for="(stage, stageIndex) in inputStages"
          :key="stage.key"
          :stage="stage"
          :class="{
            'audio-processing-stage--terminal':
              outputPaths.length === 0 &&
              processingStages.length === 0 &&
              stageIndex === inputStages.length - 1,
          }"
        />
      </div>
    </section>

    <section class="audio-processing-group" data-section="processing">
      <div class="audio-processing-header">
        <span
          class="audio-processing-quality-dot audio-processing-quality-dot--neutral"
        ></span>
        <span class="audio-processing-header-title">
          {{ $t("streamdetails.processing_header") }}
        </span>
        <span
          class="audio-processing-header-rule audio-processing-header-rule--wide"
          aria-hidden="true"
        ></span>
      </div>

      <div class="audio-processing-section">
        <AudioProcessingStage
          v-for="(stage, stageIndex) in processingStages"
          :key="stage.key"
          :stage="stage"
          :class="{
            'audio-processing-stage--terminal':
              outputPaths.length === 0 &&
              stageIndex === processingStages.length - 1,
          }"
        />
      </div>
    </section>

    <section
      v-for="(output, outputIndex) in outputPaths"
      :key="output.key"
      class="audio-processing-group"
      data-section="output"
      data-testid="audio-output-path"
      :data-player-ids="output.playerIds.join(',')"
    >
      <div class="audio-processing-header">
        <span
          class="audio-processing-quality-dot"
          :style="{ backgroundColor: qualityTierToColor(output.qualityTier) }"
        ></span>
        <span class="audio-processing-header-title">
          {{ $t("streamdetails.output_header") }}
        </span>
        <span class="audio-processing-header-meta">
          {{ output.qualityLabel }}
        </span>
        <span class="audio-processing-header-rule" aria-hidden="true"></span>
      </div>

      <div class="audio-processing-section">
        <AudioProcessingStage
          v-for="stage in output.stages"
          :key="stage.key"
          :stage="stage"
        />
        <AudioProcessingStage
          :stage="output.destination"
          :class="{
            'audio-processing-stage--terminal':
              outputIndex === outputPaths.length - 1,
          }"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from "vue";
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
import AudioProcessingStage from "@/components/AudioProcessingStage.vue";
import { useDSPPresets } from "@/composables/useDSPPresets";
import {
  audioQualityToTier,
  qualityTierToColor,
  type QualityTier,
} from "@/composables/useStreamQuality";
import { dspFilterText } from "@/helpers/audioProcessing";
import api from "@/plugins/api";
import { $t } from "@/plugins/i18n";
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
  type Player,
  type StreamDetails,
  VolumeNormalizationMode,
} from "@/plugins/api/interfaces";

interface AudioProcessingDisplayStage {
  key: string;
  icon: Component;
  title: string;
  subtitleParts?: string[];
  atomicSubtitleParts?: boolean;
  badge?: string;
  details?: string[];
}

interface AudioOutputDisplay {
  key: string;
  playerIds: string[];
  qualityTier: QualityTier;
  qualityLabel: string;
  stages: AudioProcessingDisplayStage[];
  destination: AudioProcessingDisplayStage;
}

type AudioDSPDetails = NonNullable<AudioOutputDetails["dsp"]>;

const props = defineProps<{
  chain: AudioProcessingChain;
  streamDetails: StreamDetails;
}>();
const { getPresetName } = useDSPPresets({ optional: true });

const inputQualityTier = computed(() =>
  audioQualityToTier(props.chain.input_fidelity?.quality),
);
const inputQualityLabel = computed(() =>
  audioQualityLabel(props.chain.input_fidelity?.quality),
);
const inputStages = computed(() => buildInputStages(props.streamDetails));
const processingStages = computed(() =>
  buildProcessingStages(props.streamDetails, props.chain),
);
const outputPaths = computed(() =>
  (props.chain.outputs ?? []).map(buildOutputDisplay),
);

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

function buildInputStages(
  streamDetails: StreamDetails,
): AudioProcessingDisplayStage[] {
  return [
    {
      key: "provider",
      icon: Radio,
      title: api.getProviderName(streamDetails.provider),
    },
    formatStage("source-format", streamDetails.audio_format),
  ];
}

function buildProcessingStages(
  streamDetails: StreamDetails,
  chain: AudioProcessingChain,
): AudioProcessingDisplayStage[] {
  const stages: AudioProcessingDisplayStage[] = [];
  const processing = chain.queue_processing;
  if (
    processing?.normalization &&
    processing.normalization.mode !== VolumeNormalizationMode.DISABLED
  ) {
    stages.push(normalizationStage(processing.normalization));
  }
  if (
    typeof processing?.playback_speed === "number" &&
    processing.playback_speed !== 1
  ) {
    stages.push({
      key: "playback-speed",
      icon: Gauge,
      title: $t("streamdetails.audio_processing.playback_speed", [
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
      title: $t("streamdetails.audio_processing.crossfade", [
        crossfadeModeLabel(processing.crossfade_mode),
      ]),
    });
  }
  if (processing?.overlay_active) {
    stages.push({
      key: "overlay",
      icon: Layers,
      title: $t("streamdetails.audio_processing.overlay_active"),
    });
  }
  if (processing?.pcm_format) {
    const contextStage = processingContextStage(
      streamDetails.audio_format,
      processing.pcm_format,
      chain,
      stages.length === 0,
    );
    if (contextStage) {
      stages.unshift(contextStage);
    }
  }
  return stages;
}

function buildOutputDisplay(
  output: AudioOutputDetails,
  index: number,
): AudioOutputDisplay {
  const playerIds = output.player_ids ?? [];
  const stages: AudioProcessingDisplayStage[] = [];

  if (output.dsp) {
    if (shouldShowDSPState(output.dsp)) {
      stages.push({
        key: `dsp-state-${index}`,
        icon: SlidersHorizontal,
        title: dspStateLabel(output.dsp.state),
      });
    }
    if (output.dsp.preset_id) {
      stages.push({
        key: `dsp-preset-${index}`,
        icon: SlidersHorizontal,
        title:
          getPresetName(output.dsp.preset_id) ??
          $t("settings.dsp.presets.custom"),
        subtitleParts: [$t("streamdetails.audio_processing.dsp_preset_label")],
      });
    }
    if (output.dsp.input_gain) {
      stages.push({
        key: `dsp-input-gain-${index}`,
        icon: SlidersHorizontal,
        title: $t("streamdetails.input_gain", [
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
        title: $t("streamdetails.output_gain", [
          formatNumber(output.dsp.output_gain),
        ]),
      });
    }
  }

  if (output.source_channel) {
    stages.push({
      key: `source-channel-${index}`,
      icon: Split,
      title: $t("streamdetails.audio_processing.source_channel", [
        sourceChannelLabel(output.source_channel),
      ]),
    });
  }
  if (output.dsp?.output_limiter) {
    stages.push({
      key: `output-limiter-${index}`,
      icon: Shield,
      title: $t("streamdetails.output_limiter"),
    });
  }

  stages.push(finalOutputStage(output, index));

  return {
    key: playerIds.join("|") || `output-${index}`,
    playerIds,
    qualityTier: audioQualityToTier(output.fidelity?.quality),
    qualityLabel: audioQualityLabel(output.fidelity?.quality),
    stages,
    destination: destinationStage(playerIds),
  };
}

function destinationStage(playerIds: string[]): AudioProcessingDisplayStage {
  if (playerIds.length === 0) {
    return {
      key: "destination",
      icon: Speaker,
      title: $t("streamdetails.audio_processing.destination_unavailable"),
    };
  }

  const destinations = resolveDestinations(playerIds);
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
): Array<{ playerId: string; name: string }> {
  const destinations: Array<{ playerId: string; name: string }> = [];
  const seenPlayerIds = new Set<string>();
  for (const playerId of playerIds) {
    const player = resolveDestinationPlayer(playerId);
    const resolvedPlayerId = player?.player_id ?? playerId;
    if (seenPlayerIds.has(resolvedPlayerId)) continue;
    seenPlayerIds.add(resolvedPlayerId);
    destinations.push({
      playerId: resolvedPlayerId,
      name:
        player?.name ??
        $t("streamdetails.audio_processing.destination_unknown", [playerId]),
    });
  }
  return destinations;
}

function resolveDestinationPlayer(playerId: string): Player | undefined {
  const protocolParent = Object.values(api.players).find(
    (player) =>
      player.player_id !== playerId &&
      (player.active_output_protocol === playerId ||
        player.output_protocols?.some(
          (protocol) =>
            !protocol.is_native && protocol.output_protocol_id === playerId,
        )),
  );
  return protocolParent ?? api.players[playerId];
}

function normalizationStage(
  normalization: AudioNormalizationDetails,
): AudioProcessingDisplayStage {
  const details: string[] = [
    $t("streamdetails.audio_processing.measurement_source", [
      measurementSourceLabel(normalization.measurement_source),
    ]),
  ];
  addDetail(
    details,
    "streamdetails.audio_processing.target_lufs",
    normalization.target_lufs,
  );
  addDetail(
    details,
    "streamdetails.audio_processing.measured_lufs",
    normalization.measured_lufs,
  );
  addDetail(
    details,
    "streamdetails.audio_processing.applied_gain_db",
    normalization.applied_gain_db,
  );
  return {
    key: "normalization",
    icon: AudioLines,
    title: $t("streamdetails.audio_processing.normalization_title"),
    subtitleParts: [normalizationModeLabel(normalization.mode)],
    details,
  };
}

function processingContextStage(
  sourceFormat: AudioFormat,
  internalFormat: AudioFormat,
  chain: AudioProcessingChain,
  sharedPathIsDirect: boolean,
): AudioProcessingDisplayStage | undefined {
  const internalCodec = audioFormatCodec(internalFormat);
  const internalFormatDetail = $t(
    "streamdetails.audio_processing.internal_format_detail",
    [internalFormatSummary(internalFormat)],
  );

  if (
    FLOAT_PCM_CONTENT_TYPES.has(internalCodec) &&
    !FLOAT_PCM_CONTENT_TYPES.has(audioFormatCodec(sourceFormat))
  ) {
    const details = [
      $t("streamdetails.audio_processing.processing_headroom_detail"),
      internalFormatDetail,
    ];
    const reasons = processingHeadroomReasons(chain);
    if (reasons.length > 0) {
      details.push(
        $t("streamdetails.audio_processing.processing_headroom_reasons", [
          reasons.join(", "),
        ]),
      );
    }
    return {
      key: "pcm-format",
      icon: FileAudio,
      title: $t("streamdetails.audio_processing.processing_headroom"),
      subtitleParts: [contentTypeLabel(internalCodec)],
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
        title: $t("streamdetails.audio_processing.no_shared_transforms"),
        details: [
          $t("streamdetails.audio_processing.no_shared_transforms_detail"),
          internalFormatDetail,
        ],
      };
    }
    return {
      key: "pcm-format",
      icon: FileAudio,
      title: $t("streamdetails.audio_processing.direct_signal_path"),
      details: [
        $t("streamdetails.audio_processing.direct_signal_path_detail"),
        internalFormatDetail,
        $t("streamdetails.audio_processing.direct_signal_path_inactive_detail"),
      ],
    };
  }

  if (hasMeaningfulInternalConversion(sourceFormat, internalFormat)) {
    return {
      key: "pcm-format",
      icon: FileAudio,
      title: $t("streamdetails.audio_processing.internal_format_conversion"),
      subtitleParts: [internalFormatPrimaryLabel(internalFormat)],
      atomicSubtitleParts: true,
      details: [
        $t("streamdetails.audio_processing.internal_format_conversion_detail"),
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
): AudioProcessingDisplayStage {
  const format = output.output_format;
  const details = format ? audioFormatDetails(format) : [];
  details.push(
    outputFidelityDetail(output.fidelity?.bit_perfect, output.output_format),
  );
  return {
    key: `output-format-${index}`,
    icon: FileAudio,
    title: format
      ? audioFormatTitle(format)
      : $t("streamdetails.audio_processing.unknown_format"),
    subtitleParts: format ? audioFormatTechnicalParts(format) : undefined,
    atomicSubtitleParts: true,
    badge:
      output.fidelity?.bit_perfect === true
        ? $t("streamdetails.audio_processing.bit_perfect_badge")
        : undefined,
    details,
  };
}

function formatStage(
  key: string,
  format: AudioFormat,
): AudioProcessingDisplayStage {
  return {
    key,
    icon: FileAudio,
    title: audioFormatTitle(format),
    subtitleParts: audioFormatTechnicalParts(format),
    atomicSubtitleParts: true,
    details: audioFormatDetails(format),
  };
}

function outputFidelityDetail(
  bitPerfect: boolean | null | undefined,
  format: AudioFormat | null | undefined,
): string {
  if (bitPerfect === true) {
    return $t("streamdetails.audio_processing.bit_perfect_detail");
  }
  if (bitPerfect === false) {
    if (format && LOSSY_AUDIO_CODECS.has(audioFormatCodec(format))) {
      return $t("streamdetails.audio_processing.lossy_output_detail");
    }
    return $t("streamdetails.audio_processing.samples_changed_detail");
  }
  return $t("streamdetails.audio_processing.bit_perfect_unknown_detail");
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

function processingHeadroomReasons(chain: AudioProcessingChain): string[] {
  const reasons = new Set<string>();
  const processing = chain.queue_processing;
  if (
    processing?.normalization &&
    processing.normalization.mode !== VolumeNormalizationMode.DISABLED
  ) {
    reasons.add($t("streamdetails.audio_processing.normalization_title"));
  }
  if (
    typeof processing?.playback_speed === "number" &&
    processing.playback_speed !== 1
  ) {
    reasons.add($t("streamdetails.audio_processing.playback_speed_title"));
  }
  if (
    processing?.crossfade_mode === CrossfadeMode.SMART_CROSSFADE ||
    processing?.crossfade_mode === CrossfadeMode.STANDARD_CROSSFADE
  ) {
    reasons.add($t("streamdetails.audio_processing.crossfade_title"));
  }
  if (processing?.overlay_active) {
    reasons.add($t("streamdetails.audio_processing.overlay_title"));
  }
  for (const output of chain.outputs ?? []) {
    if (!output.dsp) continue;
    if (hasActiveDSPTransform(output.dsp)) {
      reasons.add($t("streamdetails.audio_processing.dsp_title"));
    }
    if (output.dsp.output_limiter) {
      reasons.add($t("streamdetails.output_limiter"));
    }
  }
  return [...reasons];
}

function addDetail(
  details: string[],
  key: string,
  value: number | null | undefined,
): void {
  if (typeof value === "number") {
    details.push($t(key, [formatNumber(value, 2)]));
  }
}

function audioFormatTitle(format: AudioFormat): string {
  return contentTypeLabel(audioFormatCodec(format));
}

function audioFormatTechnicalParts(format: AudioFormat): string[] {
  const codec = audioFormatCodec(format);
  const parts: string[] = [];
  if (format.sample_rate > 0) {
    parts.push(
      $t("streamdetails.audio_processing.sample_rate", [
        formatNumber(format.sample_rate / 1000, 1),
      ]),
    );
  }
  if (format.bit_depth > 0 && !FLOAT_PCM_CONTENT_TYPES.has(codec)) {
    parts.push(
      $t("streamdetails.audio_processing.bit_depth", [format.bit_depth]),
    );
  }
  if (format.channels > 0) {
    parts.push(audioChannelCountLabel(format.channels));
  }
  if (format.bit_rate > 0 && !PCM_CONTENT_TYPES.has(codec)) {
    parts.push(
      $t("streamdetails.audio_processing.bit_rate", [
        formatNumber(format.bit_rate),
      ]),
    );
  }
  return parts;
}

function internalFormatPrimaryLabel(format: AudioFormat): string {
  const codec = audioFormatCodec(format);
  if (
    PCM_CONTENT_TYPES.has(codec) &&
    !FLOAT_PCM_CONTENT_TYPES.has(codec) &&
    format.bit_depth > 0
  ) {
    return $t("streamdetails.audio_processing.integer_pcm", [format.bit_depth]);
  }
  return contentTypeLabel(codec);
}

function internalFormatSummary(format: AudioFormat): string {
  const codec = audioFormatCodec(format);
  const parts = [internalFormatPrimaryLabel(format)];
  if (!PCM_CONTENT_TYPES.has(codec) && format.bit_depth > 0) {
    parts.push(
      $t("streamdetails.audio_processing.bit_depth", [format.bit_depth]),
    );
  }
  if (format.sample_rate > 0) {
    parts.push(
      $t("streamdetails.audio_processing.sample_rate", [
        formatNumber(format.sample_rate / 1000, 1),
      ]),
    );
  }
  if (format.channels > 0) {
    parts.push(audioChannelCountLabel(format.channels));
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

function audioChannelCountLabel(channels: number): string {
  if (channels === 1) {
    return $t("streamdetails.audio_processing.mono");
  }
  if (channels === 2) {
    return $t("streamdetails.audio_processing.stereo");
  }
  return $t("streamdetails.audio_processing.channel_count", [channels]);
}

function audioFormatDetails(format: AudioFormat): string[] {
  const details = [
    $t("streamdetails.file_info.container", [
      contentTypeLabel(format.content_type),
    ]),
  ];
  if (format.codec_type && format.codec_type !== ContentType.UNKNOWN) {
    details.push(
      $t("streamdetails.file_info.codec", [
        contentTypeLabel(format.codec_type),
      ]),
    );
  }
  if (format.bit_depth > 0) {
    details.push($t("streamdetails.file_info.bit_depth", [format.bit_depth]));
  }
  if (format.sample_rate > 0) {
    details.push(
      $t("streamdetails.file_info.sample_rate", [
        formatNumber(format.sample_rate / 1000, 1),
      ]),
    );
  }
  if (format.channels > 0) {
    details.push($t("streamdetails.file_info.channels", [format.channels]));
  }
  if (format.bit_rate > 0) {
    details.push(
      $t("streamdetails.file_info.bit_rate", [formatNumber(format.bit_rate)]),
    );
  }
  return details;
}

function contentTypeLabel(contentType: string | undefined): string {
  if (
    !contentType ||
    contentType === ContentType.UNKNOWN ||
    !KNOWN_CONTENT_TYPES.has(contentType)
  ) {
    return $t("streamdetails.audio_processing.unknown_format");
  }
  if (contentType === ContentType.PCM_F32LE) {
    return $t("streamdetails.audio_processing.float_pcm_32");
  }
  if (contentType === ContentType.PCM_F64LE) {
    return $t("streamdetails.audio_processing.float_pcm_64");
  }
  if (PCM_CONTENT_TYPES.has(contentType)) {
    return $t("streamdetails.audio_processing.pcm");
  }
  return contentType.toUpperCase();
}

function audioQualityLabel(quality: string | undefined): string {
  switch (quality) {
    case AudioQuality.LOW:
      return $t("streamdetails.audio_processing.quality.low");
    case AudioQuality.STANDARD:
      return $t("streamdetails.audio_processing.quality.standard");
    case AudioQuality.LOSSLESS:
      return $t("streamdetails.audio_processing.quality.lossless");
    case AudioQuality.HI_RES:
      return $t("streamdetails.audio_processing.quality.hi_res");
    default:
      return $t("streamdetails.audio_processing.quality.unknown");
  }
}

function normalizationModeLabel(mode: string | undefined): string {
  switch (mode) {
    case VolumeNormalizationMode.DISABLED:
      return $t("streamdetails.audio_processing.normalization_mode.disabled");
    case VolumeNormalizationMode.DYNAMIC:
      return $t("streamdetails.audio_processing.normalization_mode.dynamic");
    case VolumeNormalizationMode.MEASUREMENT_ONLY:
      return $t(
        "streamdetails.audio_processing.normalization_mode.measurement_only",
      );
    case VolumeNormalizationMode.FALLBACK_FIXED_GAIN:
      return $t(
        "streamdetails.audio_processing.normalization_mode.fallback_fixed_gain",
      );
    case VolumeNormalizationMode.FIXED_GAIN:
      return $t("streamdetails.audio_processing.normalization_mode.fixed_gain");
    case VolumeNormalizationMode.FALLBACK_DYNAMIC:
      return $t(
        "streamdetails.audio_processing.normalization_mode.fallback_dynamic",
      );
    default:
      return $t("streamdetails.audio_processing.unknown");
  }
}

function measurementSourceLabel(source: string | undefined): string {
  const knownSources = ["track", "album", "live", "fallback"];
  if (!source || !knownSources.includes(source)) {
    return $t("streamdetails.audio_processing.unknown");
  }
  return $t(`streamdetails.audio_processing.measurement.${source}`);
}

function crossfadeModeLabel(mode: string): string {
  switch (mode) {
    case CrossfadeMode.SMART_CROSSFADE:
      return $t("streamdetails.audio_processing.crossfade_mode.smart");
    case CrossfadeMode.STANDARD_CROSSFADE:
      return $t("streamdetails.audio_processing.crossfade_mode.standard");
    case CrossfadeMode.DISABLED:
      return $t("streamdetails.audio_processing.crossfade_mode.disabled");
    default:
      return $t("streamdetails.audio_processing.unknown");
  }
}

function dspStateLabel(state: string | undefined): string {
  switch (state) {
    case DSPState.ENABLED:
      return $t("streamdetails.audio_processing.dsp_state.enabled");
    case DSPState.DISABLED:
      return $t("streamdetails.audio_processing.dsp_state.disabled");
    case DSPState.DISABLED_BY_UNSUPPORTED_GROUP:
      return $t(
        "streamdetails.audio_processing.dsp_state.disabled_by_unsupported_group",
      );
    default:
      return $t("streamdetails.audio_processing.dsp_state.unknown");
  }
}

function sourceChannelLabel(channel: string): string {
  switch (channel) {
    case AudioChannel.FL:
      return $t("streamdetails.audio_processing.source_channel_left");
    case AudioChannel.FR:
      return $t("streamdetails.audio_processing.source_channel_right");
    default:
      return $t("streamdetails.audio_processing.unknown");
  }
}

function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
  }).format(value);
}
</script>

<style>
.audio-processing-details {
  min-width: 0;
}

.audio-processing-details .audio-processing-group + .audio-processing-group {
  margin-top: 12px;
}

.audio-processing-details .audio-processing-header {
  position: relative;
  display: grid;
  grid-template-columns: 12px max-content max-content minmax(20px, 1fr);
  column-gap: 7px;
  align-items: center;
  min-height: 22px;
}

.audio-processing-details .audio-processing-header::before {
  position: absolute;
  left: 6px;
  top: 50%;
  bottom: 0;
  border-left: 1px solid var(--border);
  content: "";
}

.audio-processing-details
  .audio-processing-group
  + .audio-processing-group
  .audio-processing-header::before {
  top: -12px;
}

.audio-processing-details .audio-processing-quality-dot {
  z-index: 1;
  grid-column: 1;
  justify-self: center;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.audio-processing-details .audio-processing-quality-dot--neutral {
  background: var(--muted-foreground);
}

.audio-processing-details .audio-processing-header-title {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.audio-processing-details .audio-processing-header-meta {
  color: var(--muted-foreground);
  font-size: 0.65rem;
  white-space: nowrap;
}

.audio-processing-details .audio-processing-header-rule {
  grid-column: 4;
  width: 100%;
  height: 1px;
  background: var(--border);
}

.audio-processing-details .audio-processing-header-rule--wide {
  grid-column: 3 / 5;
}

.audio-processing-details .audio-processing-stage {
  position: relative;
  display: grid;
  grid-template-columns: 12px 16px minmax(0, 1fr) 24px;
  column-gap: 7px;
  align-items: start;
  min-height: 24px;
}

.audio-processing-details .audio-processing-stage-connector {
  box-sizing: border-box;
  grid-column: 1;
  align-self: stretch;
  position: relative;
  width: 13px;
  min-height: 24px;
  margin-left: 6px;
  border-left: 1px solid var(--border);
}

.audio-processing-details .audio-processing-stage-connector::before {
  position: absolute;
  top: 11px;
  left: -1px;
  width: 13px;
  border-top: 1px solid var(--border);
  content: "";
}

.audio-processing-details .audio-processing-stage-connector::after {
  position: absolute;
  top: 10px;
  left: -2.5px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--muted-foreground);
  opacity: 0.7;
  content: "";
}

.audio-processing-details
  .audio-processing-stage--terminal
  .audio-processing-stage-connector {
  align-self: start;
  height: 12px;
  min-height: 0;
  border-bottom: 1px solid var(--border);
  border-bottom-left-radius: 5px;
}

.audio-processing-details
  .audio-processing-stage--terminal
  .audio-processing-stage-connector::before {
  display: none;
}

.audio-processing-details .audio-processing-stage-icon {
  grid-column: 2;
  width: 16px;
  height: 16px;
  margin-top: 4px;
}

.audio-processing-details .audio-processing-stage-copy {
  grid-column: 3;
  min-width: 0;
  padding: 3px 0;
}

.audio-processing-details .audio-processing-stage-primary {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 6px;
  line-height: 1.25;
}

.audio-processing-details .audio-processing-stage-title {
  min-width: 0;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.audio-processing-details .audio-processing-stage-badge {
  flex: 0 0 auto;
  padding: 0 5px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--muted);
  font-size: 0.625rem;
  line-height: 1.4;
  white-space: nowrap;
}

.audio-processing-details .audio-processing-stage-subtitle {
  margin-top: 1px;
  color: var(--muted-foreground);
  font-size: 0.72rem;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.audio-processing-details .audio-processing-stage-subtitle-part--atomic {
  display: inline-block;
  white-space: nowrap;
}

.audio-processing-details .audio-processing-stage-info {
  grid-column: 4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: end;
  width: 22px;
  height: 22px;
  margin-top: 1px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  color: var(--muted-foreground);
  cursor: pointer;
}

.audio-processing-details .audio-processing-stage-info:hover {
  background: var(--muted);
  color: var(--foreground);
}

.audio-processing-details .audio-processing-stage-info:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}
</style>
