<template>
  <!-- streaming quality details -->
  <TooltipProvider v-if="streamDetails" :delay-duration="200">
    <Popover>
      <!-- quality pill/chip trigger; pill = frosted glass to match the fullscreen
           header controls. A single clean PopoverTrigger so it opens reliably
           inside the fullscreen v-dialog (a Tooltip wrapper here blocked it). -->
      <PopoverTrigger as-child>
        <Button
          variant="outline"
          size="xs"
          :class="
            pill
              ? 'bg-background/40 backdrop-blur-md hover:bg-background/60'
              : ''
          "
          :disabled="triggerDisabled"
          :title="$t('show_audio_chain_details')"
        >
          <span
            class="quality-pill-dot"
            :style="{
              backgroundColor: qualityTierToColor(maxOutputQualityTier),
            }"
          ></span>
          <span class="tracking-wide">{{ qualityLabel }}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        :side="pill ? 'bottom' : 'top'"
        align="center"
        :collision-padding="12"
        class="streamdetails-popover overflow-y-auto p-3"
        :style="{
          width: 'fit-content',
          minWidth: '320px',
          maxWidth: 'calc(100vw - 25px)',
          maxHeight: 'calc(100vh - 150px)',
        }"
        @open-auto-focus.prevent
      >
        <div class="flex">
          <div>
            <!-- Input header -->
            <div class="line-space-halve"></div>
            <!-- Provider -->
            <div class="line-start"></div>
            <!-- Fileinfo -->
            <div class="line-straight"></div>
            <!-- Volume Normalization -->
            <div v-if="loudness" class="line-with-dot"></div>
            <!-- into the first output section (stays connected to the input) -->
            <div class="line-straight-halve"></div>
            <!-- Player -->
            <template
              v-for="({ dsp, player_id, players }, index) in dsp_grouped"
              :key="index"
            >
              <!-- dotted connector into each subsequent output block
                   (linked to the shared source, but a separate output) -->
              <div v-if="index > 0" class="line-dotted-halve"></div>
              <!-- Input gain -->
              <div
                v-if="dsp.input_gain && dsp.input_gain != 0"
                class="line-with-dot"
                :class="{
                  'is-dotted':
                    index > 0 &&
                    firstRailStage(dsp, player_id) === 'input_gain',
                }"
              ></div>
              <!-- DSP -->
              <div
                v-if="dsp.state == DSPState.DISABLED_BY_UNSUPPORTED_GROUP"
                class="line-straight"
                :class="{
                  'is-dotted':
                    index > 0 && firstRailStage(dsp, player_id) === 'dsp',
                }"
              ></div>
              <div
                v-for="(filter, filter_index) in dsp.filters"
                v-else
                :key="filter_index"
                class="line-with-dot"
                :class="{
                  'is-dotted':
                    index > 0 &&
                    filter_index === 0 &&
                    firstRailStage(dsp, player_id) === 'dsp',
                }"
              ></div>
              <!-- Output gain -->
              <div
                v-if="dsp.output_gain && dsp.output_gain != 0"
                class="line-with-dot"
                :class="{
                  'is-dotted':
                    index > 0 &&
                    firstRailStage(dsp, player_id) === 'output_gain',
                }"
              ></div>
              <!-- Output limiter-->
              <div
                v-if="dsp.output_limiter"
                class="line-with-dot"
                :class="{
                  'is-dotted':
                    index > 0 &&
                    firstRailStage(dsp, player_id) === 'output_limiter',
                }"
              ></div>
              <!-- Player Output format -->
              <div
                v-if="
                  streamDetails.dsp &&
                  streamDetails.dsp[player_id].output_format
                "
                class="line-with-dot"
                :class="{
                  'is-dotted':
                    index > 0 &&
                    firstRailStage(dsp, player_id) === 'output_format',
                }"
              ></div>
              <!-- Player: every block closes its own rail with the curve into
                   the player; blocks are joined by the dotted connector above -->
              <template
                v-if="
                  player_id in is_dsp_group_expanded &&
                  is_dsp_group_expanded[player_id]
                "
              >
                <template v-for="(player, i) in players" :key="i">
                  <div
                    :class="
                      i === players.length - 1 ? 'line-end' : 'line-straight'
                    "
                  ></div>
                </template>
              </template>
              <div v-else class="line-end"></div>
            </template>
          </div>
          <div class="w-full">
            <!-- Input header -->
            <div class="flex">
              <div
                class="streamdetails-separator"
                style="width: 40px; margin-right: 10px"
              ></div>
              <div
                class="quality-tier-dot"
                :style="{
                  backgroundColor: qualityTierToColor(inputQualityTier),
                }"
              ></div>
              {{ $t("streamdetails.input_header") }}
              <div
                class="streamdetails-separator flex-1"
                style="margin-left: 10px"
              ></div>
            </div>
            <!-- Provider -->
            <div class="streamdetails-item">
              <ProviderIcon
                :domain="streamDetails.provider"
                :size="22"
                class="streamdetails-icon"
                :monochrome="true"
              />
              {{
                api.providerManifests[streamDetails.provider]?.name ||
                api.providers[streamDetails.provider]?.name
              }}
            </div>
            <!-- Fileinfo -->
            <div class="streamdetails-item">
              <img
                class="streamdetails-icon invert-on-light-mode"
                :src="inputFileIcon"
                alt=""
              />
              {{ streamDetails.audio_format.sample_rate / 1000 }} kHz /
              {{ streamDetails.audio_format.bit_depth }} bits
              <template
                v-if="
                  (inputQualityTier == QualityTier.GOOD ||
                    inputQualityTier == QualityTier.LOW) &&
                  streamDetails.audio_format.bit_rate
                "
              >
                / {{ streamDetails.audio_format.bit_rate.toFixed(0) }} kbps
              </template>
              <Tooltip>
                <TooltipTrigger as-child>
                  <button type="button" class="streamdetails-info">
                    <Info :size="16" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" class="z-[10001] max-w-[300px]">
                  {{
                    $t("streamdetails.file_info.container", [
                      streamDetails.audio_format.content_type,
                    ])
                  }}
                  <br />
                  <template
                    v-if="
                      streamDetails.audio_format.codec_type !==
                      ContentType.UNKNOWN
                    "
                  >
                    {{
                      $t("streamdetails.file_info.codec", [
                        streamDetails.audio_format.codec_type,
                      ])
                    }}
                    <br />
                  </template>
                  {{
                    $t("streamdetails.file_info.bit_depth", [
                      streamDetails.audio_format.bit_depth,
                    ])
                  }}
                  <br />
                  {{
                    $t("streamdetails.file_info.sample_rate", [
                      (streamDetails.audio_format.sample_rate / 1000).toFixed(
                        1,
                      ),
                    ])
                  }}
                  <br />
                  {{
                    $t("streamdetails.file_info.channels", [
                      streamDetails.audio_format.channels,
                    ])
                  }}
                  <span v-if="streamDetails.audio_format.bit_rate">
                    <br />
                    {{
                      $t("streamdetails.file_info.bit_rate", [
                        streamDetails.audio_format.bit_rate.toFixed(0),
                      ])
                    }}
                  </span>
                </TooltipContent>
              </Tooltip>
            </div>
            <!-- Volume Normalization -->
            <div v-if="loudness" class="streamdetails-item">
              <AudioLines :size="22" class="streamdetails-glyph" />
              {{ loudness }}
              <Tooltip>
                <TooltipTrigger as-child>
                  <button type="button" class="streamdetails-info">
                    <Info :size="16" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" class="z-[10001] max-w-[350px]">
                  <span
                    v-if="
                      streamDetails.volume_normalization_mode ==
                        VolumeNormalizationMode.MEASUREMENT_ONLY &&
                      streamDetails.prefer_album_loudness &&
                      streamDetails.loudness_album != null
                    "
                  >
                    {{
                      $t(
                        "streamdetails.volume_normalization.mode.measurement_album",
                      )
                    }}
                  </span>
                  <span v-else>
                    {{
                      $t(
                        `streamdetails.volume_normalization.mode.${streamDetails.volume_normalization_mode}`,
                      )
                    }}
                  </span>
                  <br />
                  <br />
                  {{
                    $t("streamdetails.volume_normalization.target_level", [
                      streamDetails.target_loudness,
                    ])
                  }}
                  <br />
                  <span v-if="streamDetails.loudness != null">
                    {{
                      $t(
                        "streamdetails.volume_normalization.integrated_loudness",
                        [streamDetails.loudness],
                      )
                    }}
                    <br />
                  </span>
                  <span v-if="streamDetails.loudness_album != null">
                    {{
                      $t(
                        "streamdetails.volume_normalization.integrated_album_loudness",
                        [streamDetails.loudness_album],
                      )
                    }}
                    <br />
                  </span>
                  <span
                    v-if="
                      streamDetails.volume_normalization_gain_correct != null
                    "
                  >
                    {{
                      $t(
                        "streamdetails.volume_normalization.applied_gain_correction",
                        [streamDetails.volume_normalization_gain_correct],
                      )
                    }}
                    <br />
                  </span>
                </TooltipContent>
              </Tooltip>
            </div>

            <template
              v-for="({ dsp, player_id, players }, index) in dsp_grouped"
              :key="index"
            >
              <!-- Separator -->
              <div class="flex">
                <div
                  class="streamdetails-separator"
                  style="width: 40px; margin-right: 10px"
                ></div>
                <div
                  class="quality-tier-dot"
                  :style="{
                    backgroundColor: qualityTierToColor(
                      combinedOutputQualityTiers[player_id],
                    ),
                  }"
                ></div>
                {{ $t("streamdetails.output_header") }}
                <div
                  class="streamdetails-separator flex-1"
                  style="margin-left: 10px"
                ></div>
              </div>
              <!-- Input gain -->
              <div
                v-if="dsp.input_gain && dsp.input_gain != 0"
                class="streamdetails-item"
              >
                <SlidersHorizontal :size="22" class="streamdetails-glyph" />
                {{
                  $t("streamdetails.input_gain", [dsp.input_gain.toFixed(1)])
                }}
              </div>
              <!-- DSP -->
              <div
                v-if="dsp.state == DSPState.DISABLED_BY_UNSUPPORTED_GROUP"
                class="streamdetails-item"
              >
                <SlidersHorizontal
                  :size="22"
                  class="streamdetails-glyph text-muted-foreground"
                />
                {{ $t("streamdetails.dsp_unsupported") }}
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button type="button" class="streamdetails-info">
                      <Info :size="16" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" class="z-[10001] max-w-[300px]">
                    {{ $t("streamdetails.dsp_disabled_by_unsupported_group") }}
                  </TooltipContent>
                </Tooltip>
              </div>
              <div
                v-for="(filter, i) in dsp.filters"
                v-else
                :key="i"
                class="streamdetails-item"
              >
                <SlidersHorizontal :size="22" class="streamdetails-glyph" />
                {{ dspFilterText(filter) }}
              </div>
              <!-- Output gain -->
              <div
                v-if="dsp.output_gain && dsp.output_gain != 0"
                class="streamdetails-item"
              >
                <SlidersHorizontal :size="22" class="streamdetails-glyph" />
                {{
                  $t("streamdetails.output_gain", [dsp.input_gain.toFixed(1)])
                }}
              </div>
              <!-- Output limiter-->
              <div v-if="dsp.output_limiter" class="streamdetails-item">
                <SlidersHorizontal :size="22" class="streamdetails-glyph" />
                {{ $t("streamdetails.output_limiter") }}
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button type="button" class="streamdetails-info">
                      <Info :size="16" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" class="z-[10001] max-w-[300px]">
                    {{ $t("streamdetails.output_limiter_info") }}
                  </TooltipContent>
                </Tooltip>
              </div>
              <!-- Player Output format -->
              <div
                v-if="
                  streamDetails.dsp &&
                  streamDetails.dsp[player_id].output_format
                "
                class="streamdetails-item"
              >
                <img
                  class="streamdetails-icon invert-on-light-mode"
                  :src="
                    getContentTypeIcon(
                      streamDetails.dsp[player_id].output_format.content_type,
                    ) || iconFallback
                  "
                  alt=""
                />
                {{
                  streamDetails.dsp[player_id].output_format.sample_rate / 1000
                }}
                kHz /
                {{ streamDetails.dsp[player_id].output_format.bit_depth }} bits
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button type="button" class="streamdetails-info">
                      <Info :size="16" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" class="z-[10001] max-w-[300px]">
                    {{
                      $t("streamdetails.file_info.container", [
                        streamDetails.dsp[player_id].output_format.content_type,
                      ])
                    }}
                    <br />
                    <template
                      v-if="
                        streamDetails.dsp[player_id].output_format
                          .codec_type !== ContentType.UNKNOWN
                      "
                    >
                      {{
                        $t("streamdetails.file_info.codec", [
                          streamDetails.dsp[player_id].output_format.codec_type,
                        ])
                      }}
                      <br />
                    </template>
                    {{
                      $t("streamdetails.file_info.bit_depth", [
                        streamDetails.dsp[player_id].output_format.bit_depth,
                      ])
                    }}
                    <br />
                    {{
                      $t("streamdetails.file_info.sample_rate", [
                        (
                          streamDetails.dsp[player_id].output_format
                            .sample_rate / 1000
                        ).toFixed(1),
                      ])
                    }}
                    <br />
                    {{
                      $t("streamdetails.file_info.channels", [
                        streamDetails.dsp[player_id].output_format.channels,
                      ])
                    }}
                    <span
                      v-if="streamDetails.dsp[player_id].output_format.bit_rate"
                    >
                      <br />
                      {{
                        $t("streamdetails.file_info.bit_rate", [
                          streamDetails.dsp[
                            player_id
                          ].output_format.bit_rate.toFixed(0),
                        ])
                      }}
                    </span>
                  </TooltipContent>
                </Tooltip>
              </div>
              <!-- Player -->
              <template
                v-if="
                  player_id in is_dsp_group_expanded &&
                  is_dsp_group_expanded[player_id]
                "
              >
                <div
                  v-for="(player, i) in players"
                  :key="i"
                  class="streamdetails-item"
                  @click="is_dsp_group_expanded[player_id] = false"
                >
                  <template v-if="api.players[player]">
                    <ProviderIcon
                      :domain="outputProtocolDomain(api.players[player_id])"
                      :size="22"
                      class="streamdetails-icon"
                      :monochrome="true"
                    />
                    {{ api.players[player].name }}
                  </template>
                  <template v-else>
                    <!-- This should not happen -->
                    <AlertCircle
                      :size="22"
                      class="streamdetails-glyph text-muted-foreground"
                    />
                    Player not found
                  </template>
                </div>
              </template>
              <div
                v-else
                class="streamdetails-item"
                @click="is_dsp_group_expanded[player_id] = true"
              >
                <template v-if="api.players[player_id]">
                  <ProviderIcon
                    :domain="outputProtocolDomain(api.players[player_id])"
                    :size="22"
                    class="streamdetails-icon"
                    :monochrome="true"
                  />
                  <template v-if="players.length == 1">
                    {{ api.players[player_id].name }}
                  </template>
                  <template v-else>
                    {{ api.players[player_id].name }} +
                    {{ players.length - 1 }}
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <button type="button" class="streamdetails-info">
                          <Info :size="16" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        class="z-[10001] max-w-[300px]"
                      >
                        {{ $t("streamdetails.click_to_expand") }}
                      </TooltipContent>
                    </Tooltip>
                  </template>
                </template>
                <template v-else>
                  <!-- This should not happen -->
                  <AlertCircle
                    :size="22"
                    class="streamdetails-glyph text-muted-foreground"
                  />
                  Player not found
                </template>
              </div>
            </template>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  </TooltipProvider>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AlertCircle, AudioLines, Info, SlidersHorizontal } from "@lucide/vue";
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import {
  AudioFormat,
  ContentType,
  DSPDetails,
  DSPFilter,
  DSPFilterType,
  DSPState,
  Player,
  VolumeNormalizationMode,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

// render the quality indicator as a rounded "pill" (matching the shadcn player
// header controls) instead of the default square chip
defineProps<{ pill?: boolean }>();

// computed properties
const streamDetails = computed(() => {
  return store.activePlayerQueue?.current_item?.streamdetails;
});
const loudness = computed(() => {
  const sd = streamDetails.value;
  if (!sd) return null;

  // prefer new dedicated volume_normalization_gain_correct attribute
  // which just contains the gain correction that is applied to the stream
  if (sd.volume_normalization_gain_correct != null) {
    const prefix = sd.volume_normalization_gain_correct > 0 ? "+" : "";
    return $t("volume_normalization_gain_correction", [
      prefix + sd.volume_normalization_gain_correct,
    ]);
  }

  // fallback to just displaying the measurement value or the dynamic/fixed gain mode
  // TODO: remove this at some point in the future
  if (
    sd.volume_normalization_mode == VolumeNormalizationMode.MEASUREMENT_ONLY &&
    sd.loudness !== null
  ) {
    if (sd.prefer_album_loudness && sd.loudness_album !== null) {
      return $t("loudness_measurement_album", [sd.loudness_album?.toFixed(2)]);
    } else {
      return $t("loudness_measurement", [sd.loudness?.toFixed(2)]);
    }
  } else if (sd.volume_normalization_mode == VolumeNormalizationMode.DYNAMIC) {
    return $t("loudness_dynamic");
  } else if (
    sd.volume_normalization_mode == VolumeNormalizationMode.FIXED_GAIN
  ) {
    return $t("loudness_fixed");
  } else {
    return null;
  }
});

// Groups players with identical DSPDetails (and therefore output format) together
const dsp_grouped = computed(() => {
  if (!streamDetails.value || !streamDetails.value.dsp) return [];
  const grouped: { dsp: DSPDetails; player_id: string; players: string[] }[] =
    [];
  for (const [player_id, dsp] of Object.entries(streamDetails.value.dsp)) {
    const identical_dsp = grouped.find(
      (g) => JSON.stringify(g.dsp) === JSON.stringify(dsp),
    );
    if (identical_dsp) {
      identical_dsp.players.push(player_id);
    } else {
      grouped.push({
        dsp: dsp,
        player_id: player_id,
        players: [player_id],
      });
    }
  }

  return grouped;
});
// Determine the first rail segment of an output block, so the dotted
// connector into a subsequent block can be continued through that first
// segment (keeping the transition consistently dotted rather than
// part-dotted/part-solid). Must mirror the rail markup order below.
const firstRailStage = function (dsp: DSPDetails, player_id: string) {
  if (dsp.input_gain && dsp.input_gain != 0) return "input_gain";
  if (dsp.state == DSPState.DISABLED_BY_UNSUPPORTED_GROUP) return "dsp";
  if (dsp.filters && dsp.filters.length > 0) return "dsp";
  if (dsp.output_gain && dsp.output_gain != 0) return "output_gain";
  if (dsp.output_limiter) return "output_limiter";
  if (
    streamDetails.value &&
    streamDetails.value.dsp &&
    streamDetails.value.dsp[player_id].output_format
  )
    return "output_format";
  return "player";
};
// Each output "group" can be individually expanded
const is_dsp_group_expanded = ref<Record<string, boolean>>({});
const isPcm = function (contentType: ContentType) {
  return [
    ContentType.PCM_S16LE,
    ContentType.PCM_S24LE,
    ContentType.PCM_S32LE,
    ContentType.PCM_F32LE,
    ContentType.PCM_F64LE,
  ].includes(contentType);
};
const getContentTypeIcon = function (contentType: ContentType) {
  if (contentType == ContentType.AAC) return iconAac;
  if (contentType == ContentType.FLAC) return iconFlac;
  if (contentType == ContentType.MP3) return iconMp3;
  if (contentType == ContentType.MPEG) return iconMp3;
  if (contentType == ContentType.OGG) return iconOgg;
  if (contentType == ContentType.M4A) return iconM4a;
  if (contentType == ContentType.WAV) return iconWAV;
  if (contentType == ContentType.ALAC) return iconALAC;
  if (isPcm(contentType)) return iconPcm;
  return null;
};
const inputFileIcon = computed(() => {
  if (!streamDetails.value) return iconFallback;
  let icon = getContentTypeIcon(streamDetails.value.audio_format.codec_type);
  if (icon === null) {
    // Codec has no icon, try to fall back to container icon
    icon = getContentTypeIcon(streamDetails.value.audio_format.content_type);
  }
  if (icon === null) {
    // No icon found, fall back to generic icon
    icon = iconFallback;
  }
  return icon;
});

enum QualityTier {
  UNKNOWN = 0,
  LOW = 1,
  GOOD = 2,
  LOSSLESS = 3,
  HIRES = 4,
}

const isContentTypeLossless = function (contentType: ContentType) {
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
};

const isHiResFormat = function (audioFormat: AudioFormat) {
  if (
    !isContentTypeLossless(audioFormat.content_type) &&
    !isContentTypeLossless(audioFormat.codec_type)
  )
    return false;
  return audioFormat.bit_depth > 16 || audioFormat.sample_rate > 48000;
};

const inputQualityTier = computed(() => {
  const sd = streamDetails.value;
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
  const tiers: Record<string, QualityTier> = {};
  if (!streamDetails.value?.dsp) {
    return tiers;
  }
  for (const [player_id, dsp] of Object.entries(streamDetails.value.dsp)) {
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

const qualityTierToColor = function (tier: QualityTier) {
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
};

const outputProtocolDomain = function (player: Player) {
  if (
    player.active_output_protocol &&
    player.active_output_protocol != "native"
  ) {
    for (const protocol of player.output_protocols || []) {
      if (protocol.output_protocol_id == player.active_output_protocol) {
        return protocol.protocol_domain!;
      }
    }
  }
  return player.provider.split("--")[0];
};

const combinedOutputQualityTiers = computed(() => {
  // like outputQualityTiers, but limited by the input quality
  const tiers: Record<string, QualityTier> = {};
  if (!streamDetails.value?.dsp) {
    return tiers;
  }
  const inputTier = inputQualityTier.value;
  for (const [player_id, dsp] of Object.entries(streamDetails.value.dsp)) {
    // Output quality can never be higher than input quality
    tiers[player_id] = Math.min(outputQualityTiers.value[player_id], inputTier);
  }
  return tiers;
});

const minOutputQualityTier = computed(() => {
  return Math.min(...Object.values(combinedOutputQualityTiers.value));
});

const maxOutputQualityTier = computed(() => {
  return Math.max(...Object.values(combinedOutputQualityTiers.value));
});

const dspFilterText = function (filter: DSPFilter) {
  let text = $t("settings.dsp.types." + filter.type);
  if (filter.type === DSPFilterType.PARAMETRIC_EQ) {
    const enabledBandsCount = filter.bands.filter(
      (band) => band.enabled,
    ).length;
    if (enabledBandsCount === 1)
      text += ` (${$t("streamdetails.eq_band_count_singular")})`;
    else text += ` (${$t("streamdetails.eq_band_count", [enabledBandsCount])})`;
  }
  return text;
};

// two-letter quality label shown inside the trigger button (LQ/SQ/HQ/HR)
const qualityLabel = computed(() => {
  switch (maxOutputQualityTier.value) {
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
});

// disable the trigger when there is no active queue with items
const triggerDisabled = computed(
  () =>
    !store.activePlayerQueue ||
    !store.activePlayerQueue?.active ||
    store.activePlayerQueue?.items == 0,
);
</script>

<script lang="ts">
export const iconFallback = new URL("@/assets/fallback.png", import.meta.url)
  .href;
export const iconAac = new URL("@/assets/aac.png", import.meta.url).href;
export const iconFlac = new URL("@/assets/flac.png", import.meta.url).href;
export const iconMp3 = new URL("@/assets/mp3.png", import.meta.url).href;
export const iconOgg = new URL("@/assets/ogg.png", import.meta.url).href;
export const iconVorbis = new URL("@/assets/vorbis.png", import.meta.url).href;
export const iconM4a = new URL("@/assets/m4a.png", import.meta.url).href;
export const iconHiRes = new URL("@/assets/hires.png", import.meta.url).href;
export const iconPcm = new URL("@/assets/pcm.svg", import.meta.url).href;
export const iconWAV = new URL("@/assets/wav.png", import.meta.url).href;
export const iconALAC = new URL("@/assets/alac.png", import.meta.url).href;

export const imgCoverDark = new URL("@/assets/cover_dark.png", import.meta.url)
  .href;
export const imgCoverLight = new URL(
  "@/assets/cover_light.png",
  import.meta.url,
).href;
export const iconFolder = new URL("@/assets/folder.svg", import.meta.url).href;
</script>

<style>
.streamdetails-info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  padding: 0;
  border: none;
  background: none;
  color: var(--muted-foreground);
  cursor: pointer;
}

.streamdetails-info:hover {
  color: var(--foreground);
}

.streamdetails-glyph {
  width: 22px;
  height: 22px;
  /* centered within the same 32px icon column (then 8px gap to the text) */
  margin-left: 5px;
  margin-right: 13px;
  flex: 0 0 auto;
}

.streamdetails-item {
  height: var(--sd-row);
  display: flex;
  align-items: center;
}

@media (max-width: 400px) {
  .streamdetails-item {
    font-size: 0.9rem;
  }
}

@media (max-width: 370px) {
  .streamdetails-item {
    font-size: 0.8rem;
  }
}

.streamdetails-popover {
  /* single knob for the diagram's vertical rhythm; connector lines derive
     their heights from this so content rows and the rail stay in lockstep */
  --sd-row: 34px;
  font-size: 0.875rem;
}

.streamdetails-icon {
  /* width + margins use !important to beat ProviderIcon's inline width and its
     10px side margins, so provider glyphs share the same 32px column as the
     <img> icons and every row's text starts at the same x. Content is CENTERED
     in the column: the codec logos (flac/mp3/...) have symmetric transparent
     padding baked into their PNGs, so their artwork is canvas-centered — centering
     the whole column keeps every glyph balanced on one axis (left-aligning made
     the codec artwork look inset / shifted right). */
  width: 32px !important;
  height: 22px;
  margin-left: 0 !important;
  margin-right: 8px !important;
  flex: 0 0 auto;
  object-fit: contain;
  object-position: center;
}

/* ProviderIcon renders a <div>; center its inner glyph within the 32px cell */
div.streamdetails-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.invert-on-light-mode {
  filter: invert(100%);
}

.dark .invert-on-light-mode {
  filter: none;
}

.streamdetails-separator {
  height: calc(var(--sd-row) / 4);
  display: flex;
  align-items: center;
  margin-top: calc(var(--sd-row) / 4);
  border-style: dotted;
  border-width: 1px;
  border-bottom: none;
  border-left: none;
  border-right: none;
}

.line-space {
  height: var(--sd-row);
  width: 16px;
}

.line-space-halve {
  height: calc(var(--sd-row) / 2);
  width: 16px;
}

.line-start {
  border-top-left-radius: calc(var(--sd-row) / 4);
  height: calc(var(--sd-row) / 2);
  width: 16px;
  margin-top: calc(var(--sd-row) / 2);
  margin-left: 8px;
  border-width: 1px;
  border-style: solid;
  border-bottom: none;
  border-right: none;
}

.line-end {
  border-bottom-left-radius: calc(var(--sd-row) / 4);
  height: calc(var(--sd-row) / 2);
  width: 16px;
  margin-bottom: calc(var(--sd-row) / 2);
  margin-left: 8px;
  border-width: 1px;
  border-style: solid;
  border-top: none;
  border-right: none;
}

.line-straight {
  height: var(--sd-row);
  width: 16px;
  margin-left: 8px;
  border-left-width: 1px;
  border-left-style: solid;
  border-top: none;
  border-right: none;
  border-bottom: none;
}

.line-straight-halve {
  height: calc(var(--sd-row) / 2);
  width: 16px;
  margin-left: 8px;
  border-left-width: 1px;
  border-left-style: solid;
  border-top: none;
  border-right: none;
  border-bottom: none;
}

/* dotted boundary between output blocks: they share the source but are
   separate outputs, so the connector is dotted rather than solid */
.line-dotted-halve {
  height: calc(var(--sd-row) / 2);
  width: 16px;
  margin-left: 8px;
  border-left-width: 1px;
  border-left-style: dotted;
  border-top: none;
  border-right: none;
  border-bottom: none;
}

.line-with-dot {
  height: var(--sd-row);
  width: 16px;
  margin-left: 8px;
  border-left-width: 1px;
  border-left-style: solid;
  border-top: none;
  border-right: none;
  border-bottom: none;
  position: relative;
}

.line-with-dot::before {
  content: "";
  position: absolute;
  transform: translate(-50%, -50%);
  margin-top: calc(var(--sd-row) / 2);
  height: 14px;
  width: 14px;
  background-color: var(--foreground);
  border-radius: 50%;
}

.line-with-dot::after {
  content: "";
  position: absolute;
  transform: translate(-50%, -50%);
  margin-top: calc(var(--sd-row) / 2);
  height: 10px;
  width: 10px;
  background-color: var(--primary);
  border-radius: 50%;
}

/* dotted continuation of the block boundary: applied to the first rail
   segment of a subsequent output block so the transition off the shared
   source reads as one dotted branch (node dots stay solid) */
.line-with-dot.is-dotted,
.line-straight.is-dotted {
  border-left-style: dotted;
}

.quality-tier-dot {
  height: 8px;
  width: 8px;
  border-radius: 50%;
  margin: auto;
  margin-right: 10px;
}

.quality-pill-dot {
  display: inline-block;
  height: 8px;
  width: 8px;
  border-radius: 50%;
  flex: 0 0 auto;
}
</style>
