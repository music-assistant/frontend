<template>
  <TooltipProvider :delay-duration="200">
    <div
      class="audio-processing-details"
      data-testid="audio-processing-details"
    >
      <div class="streamdetails-header">
        <div
          class="streamdetails-separator"
          style="width: 40px; margin-right: 10px"
        ></div>
        <div
          class="quality-tier-dot"
          :style="{ backgroundColor: qualityTierToColor(inputQualityTier) }"
        ></div>
        {{ $t("streamdetails.input_header") }}
        <span class="audio-processing-header-meta">
          {{ inputQualityLabel }}
        </span>
        <div
          class="streamdetails-separator flex-1"
          style="margin-left: 10px"
        ></div>
      </div>

      <div class="audio-processing-section">
        <AudioProcessingStage
          v-for="stage in inputStages"
          :key="stage.key"
          :stage="stage"
        />
      </div>

      <template v-for="output in outputPaths" :key="output.key">
        <div
          class="streamdetails-header audio-processing-output-header"
          data-testid="audio-output-path"
          :data-player-ids="output.playerIds.join(',')"
        >
          <div
            class="streamdetails-separator"
            style="width: 40px; margin-right: 10px"
          ></div>
          <div
            class="quality-tier-dot"
            :style="{ backgroundColor: qualityTierToColor(output.qualityTier) }"
          ></div>
          {{ $t("streamdetails.output_header") }}
          <span class="audio-processing-header-meta">
            {{ output.qualityLabel }}
          </span>
          <div
            class="streamdetails-separator flex-1"
            style="margin-left: 10px"
          ></div>
        </div>

        <div class="audio-processing-section">
          <AudioProcessingStage
            v-for="stage in output.stages"
            :key="stage.key"
            :stage="stage"
          />
          <div
            v-for="playerId in output.playerIds"
            :key="playerId"
            class="streamdetails-item"
            data-stage="destination"
          >
            <Speaker :size="22" class="streamdetails-glyph" />
            {{
              api.players[playerId]?.name ||
              $t("streamdetails.audio_processing.destination_unknown", [
                playerId,
              ])
            }}
          </div>
          <div
            v-if="output.playerIds.length === 0"
            class="streamdetails-item"
            data-stage="destination"
          >
            <Speaker :size="22" class="streamdetails-glyph" />
            {{ $t("streamdetails.audio_processing.destination_unavailable") }}
          </div>
        </div>
      </template>
    </div>
  </TooltipProvider>
</template>

<script setup lang="ts">
import { computed, type Component } from "vue";
import {
  AudioLines,
  BadgeCheck,
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
import { TooltipProvider } from "@/components/ui/tooltip";
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
  type StreamDetails,
  VolumeNormalizationMode,
} from "@/plugins/api/interfaces";

interface AudioProcessingDisplayStage {
  key: string;
  icon: Component;
  label: string;
  details?: string[];
}

interface AudioOutputDisplay {
  key: string;
  playerIds: string[];
  qualityTier: QualityTier;
  qualityLabel: string;
  stages: AudioProcessingDisplayStage[];
}

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
const inputStages = computed(() =>
  buildInputStages(props.streamDetails, props.chain),
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

function buildInputStages(
  streamDetails: StreamDetails,
  chain: AudioProcessingChain,
): AudioProcessingDisplayStage[] {
  const stages: AudioProcessingDisplayStage[] = [
    {
      key: "provider",
      icon: Radio,
      label: $t("streamdetails.audio_processing.provider", [
        api.getProviderName(streamDetails.provider),
      ]),
    },
  ];
  addFormatStage(
    stages,
    "source-format",
    "streamdetails.audio_processing.source_format",
    streamDetails.audio_format,
  );

  const processing = chain.queue_processing;
  addFormatStage(
    stages,
    "pcm-format",
    "streamdetails.audio_processing.pcm_format",
    processing?.pcm_format,
  );
  if (processing?.normalization) {
    stages.push(normalizationStage(processing.normalization));
  }
  if (
    typeof processing?.playback_speed === "number" &&
    processing.playback_speed !== 1
  ) {
    stages.push({
      key: "playback-speed",
      icon: Gauge,
      label: $t("streamdetails.audio_processing.playback_speed", [
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
      label: $t("streamdetails.audio_processing.crossfade", [
        crossfadeModeLabel(processing.crossfade_mode),
      ]),
    });
  }
  if (processing?.overlay_active) {
    stages.push({
      key: "overlay",
      icon: Layers,
      label: $t("streamdetails.audio_processing.overlay_active"),
    });
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
    stages.push({
      key: `dsp-state-${index}`,
      icon: SlidersHorizontal,
      label: dspStateLabel(output.dsp.state),
    });
    if (output.dsp.preset_id) {
      stages.push({
        key: `dsp-preset-${index}`,
        icon: SlidersHorizontal,
        label: $t("streamdetails.audio_processing.dsp_preset", [
          getPresetName(output.dsp.preset_id) ??
            $t("settings.dsp.presets.custom"),
        ]),
      });
    }
    if (output.dsp.input_gain) {
      stages.push({
        key: `dsp-input-gain-${index}`,
        icon: SlidersHorizontal,
        label: $t("streamdetails.input_gain", [
          formatNumber(output.dsp.input_gain),
        ]),
      });
    }
    for (const [filterIndex, filter] of (output.dsp.filters ?? []).entries()) {
      stages.push({
        key: `dsp-filter-${index}-${filterIndex}`,
        icon: SlidersHorizontal,
        label: dspFilterText(filter),
      });
    }
    if (output.dsp.output_gain) {
      stages.push({
        key: `dsp-output-gain-${index}`,
        icon: SlidersHorizontal,
        label: $t("streamdetails.output_gain", [
          formatNumber(output.dsp.output_gain),
        ]),
      });
    }
    if (output.dsp.output_limiter) {
      stages.push({
        key: `output-limiter-${index}`,
        icon: Shield,
        label: $t("streamdetails.output_limiter"),
      });
    }
  }

  if (output.source_channel) {
    stages.push({
      key: `source-channel-${index}`,
      icon: Split,
      label: $t("streamdetails.audio_processing.source_channel", [
        sourceChannelLabel(output.source_channel),
      ]),
    });
  }
  addFormatStage(
    stages,
    `output-format-${index}`,
    "streamdetails.audio_processing.output_format",
    output.output_format,
  );
  if (
    output.fidelity?.bit_perfect !== null &&
    output.fidelity?.bit_perfect !== undefined
  ) {
    stages.push({
      key: `bit-perfect-${index}`,
      icon: BadgeCheck,
      label: output.fidelity.bit_perfect
        ? $t("streamdetails.audio_processing.bit_perfect")
        : $t("streamdetails.audio_processing.not_bit_perfect"),
    });
  }

  return {
    key: playerIds.join("|") || `output-${index}`,
    playerIds,
    qualityTier: audioQualityToTier(output.fidelity?.quality),
    qualityLabel: audioQualityLabel(output.fidelity?.quality),
    stages,
  };
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
    label: $t("streamdetails.audio_processing.normalization", [
      normalizationModeLabel(normalization.mode),
    ]),
    details,
  };
}

function addFormatStage(
  stages: AudioProcessingDisplayStage[],
  key: string,
  labelKey: string,
  format: AudioFormat | null | undefined,
): void {
  if (!format) return;
  stages.push({
    key,
    icon: FileAudio,
    label: $t(labelKey, [audioFormatSummary(format)]),
    details: audioFormatDetails(format),
  });
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

function audioFormatSummary(format: AudioFormat): string {
  const codec =
    format.codec_type && format.codec_type !== ContentType.UNKNOWN
      ? format.codec_type
      : format.content_type;
  const parts = [contentTypeLabel(codec)];
  if (format.sample_rate > 0) {
    parts.push(
      $t("streamdetails.audio_processing.sample_rate", [
        formatNumber(format.sample_rate / 1000, 1),
      ]),
    );
  }
  if (format.bit_depth > 0) {
    parts.push(
      $t("streamdetails.audio_processing.bit_depth", [format.bit_depth]),
    );
  }
  if (format.channels > 0) {
    parts.push(
      $t("streamdetails.audio_processing.channel_count", [format.channels]),
    );
  }
  if (format.bit_rate > 0 && !PCM_CONTENT_TYPES.has(codec)) {
    parts.push(
      $t("streamdetails.audio_processing.bit_rate", [
        formatNumber(format.bit_rate),
      ]),
    );
  }
  return parts.join(" · ");
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

<style scoped>
.audio-processing-details {
  min-width: 300px;
}

.audio-processing-section {
  border-left: 1px solid var(--border);
  margin-left: 16px;
  padding-left: 8px;
}

.audio-processing-output-header {
  margin-top: calc(var(--sd-row) / 2);
}

.audio-processing-header-meta {
  color: var(--muted-foreground);
  font-size: 0.75rem;
  margin-left: 6px;
  white-space: nowrap;
}
</style>
