<template>
  <!-- streaming quality details -->
  <v-menu
    v-if="streamDetails"
    location="top center"
    :close-on-content-click="false"
    scrim
    :max-height="$vuetify.display.height - 150"
  >
    <template #activator="{ props }">
      <v-chip
        v-if="streamDetails"
        :disabled="
          !store.activePlayerQueue ||
          !store.activePlayerQueue?.active ||
          store.activePlayerQueue?.items == 0
        "
        class="mediadetails-content-type-btn"
        label
        :ripple="false"
        v-bind="props"
      >
        <div
          class="quality-tier-dot"
          :style="{
            backgroundColor: qualityTierToColor(maxOutputQualityTier),
          }"
        ></div>
        <div v-if="maxOutputQualityTier == QualityTier.LOW">LQ</div>
        <div v-else-if="maxOutputQualityTier == QualityTier.GOOD">HQ</div>
        <div v-else-if="maxOutputQualityTier == QualityTier.HIRES">HR</div>
      </v-chip>
    </template>
    <v-card class="mx-auto" :width="Math.min($vuetify.display.width - 25, 380)">
      <v-list style="overflow: hidden">
        <div class="d-flex ml-2 mr-2">
          <!-- Second line showing audio stream shared by multiple players -->
          <div v-if="dsp_grouped.length >= 2">
            <!-- Input header -->
            <div class="line-space-halve"></div>
            <!-- Provider -->
            <div class="line-space"></div>
            <!-- Fileinfo -->
            <div class="line-space"></div>
            <!-- Volume Normalization -->
            <div class="line-space"></div>
            <!-- Branch if multiple players playing -->
            <div class="line-branch-start-left"></div>
            <!-- Player -->
            <template
              v-for="({ dsp, player_id, players }, index) in dsp_grouped"
              :key="index"
            >
              <!-- rejoin the original stream -->
              <div
                v-if="index == dsp_grouped.length - 1"
                class="line-branch-end-left"
              ></div>
              <div v-else-if="index > 0" class="line-branch-split-left"></div>
              <template v-if="index != dsp_grouped.length - 1">
                <!-- Input gain -->
                <div
                  v-if="dsp.input_gain && dsp.input_gain != 0"
                  class="line-straight"
                ></div>
                <!-- DSP -->
                <div
                  v-if="dsp.state == DSPState.DISABLED_BY_UNSUPPORTED_GROUP"
                  class="line-straight"
                ></div>
                <div
                  v-for="(filter, filter_index) in dsp.filters"
                  v-else
                  :key="filter_index"
                  class="line-straight"
                ></div>
                <!-- Output gain -->
                <div
                  v-if="dsp.output_gain && dsp.output_gain != 0"
                  class="line-straight"
                ></div>
                <!-- Output limiter-->
                <div v-if="dsp.output_limiter" class="line-straight"></div>
                <!-- Player Output format -->
                <div
                  v-if="
                    streamDetails.dsp &&
                    streamDetails.dsp[player_id].output_format
                  "
                  class="line-straight"
                ></div>
                <!-- Player -->
                <template
                  v-if="
                    player_id in is_dsp_group_expanded &&
                    is_dsp_group_expanded[player_id]
                  "
                >
                  <div
                    v-for="(_player, i) in players"
                    :key="i"
                    class="line-straight"
                  ></div
                ></template>
                <div v-else class="line-straight"></div>
              </template>
            </template>
          </div>
          <div>
            <!-- Input header -->
            <div class="line-space-halve"></div>
            <!-- Provider -->
            <div class="line-start"></div>
            <!-- Fileinfo -->
            <div class="line-straight"></div>
            <!-- Volume Normalization -->
            <div class="line-with-dot"></div>
            <!-- Branch if multiple players playing -->
            <div
              v-if="dsp_grouped.length >= 2"
              class="line-branch-start-right"
            ></div>
            <div v-else class="line-straight-halve"></div>
            <!-- Player -->
            <template
              v-for="({ dsp, player_id, players }, index) in dsp_grouped"
              :key="index"
            >
              <!-- rejoin the original stream -->
              <div v-if="index > 0" class="line-branch-rejoin-right"></div>
              <!-- Input gain -->
              <div
                v-if="dsp.input_gain && dsp.input_gain != 0"
                class="line-with-dot"
              ></div>
              <!-- DSP -->
              <div
                v-if="dsp.state == DSPState.DISABLED_BY_UNSUPPORTED_GROUP"
                class="line-straight"
              ></div>
              <div
                v-for="(filter, filter_index) in dsp.filters"
                v-else
                :key="filter_index"
                class="line-with-dot"
              ></div>
              <!-- Output gain -->
              <div
                v-if="dsp.output_gain && dsp.output_gain != 0"
                class="line-with-dot"
              ></div>
              <!-- Output limiter-->
              <div v-if="dsp.output_limiter" class="line-with-dot"></div>
              <!-- Player Output format -->
              <div
                v-if="
                  streamDetails.dsp &&
                  streamDetails.dsp[player_id].output_format
                "
                class="line-with-dot"
              ></div>
              <!-- Player-->
              <template
                v-if="
                  player_id in is_dsp_group_expanded &&
                  is_dsp_group_expanded[player_id]
                "
              >
                <template v-for="(player, i) in players" :key="i">
                  <div v-if="i === players.length - 1" class="line-end"></div>
                  <div v-else class="line-branch-output"></div> </template
              ></template>
              <div v-else class="line-end"></div>
            </template>
          </div>
          <div class="w-100">
            <!-- Input header -->
            <div class="d-flex">
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
                class="streamdetails-separator flex-fill"
                style="margin-left: 10px"
              ></div>
            </div>
            <!-- Provider -->
            <div class="streamdetails-item">
              <ProviderIcon
                :domain="streamDetails.provider"
                :size="30"
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
              />
              {{ streamDetails.audio_format.sample_rate / 1000 }} kHz /
              {{ streamDetails.audio_format.bit_depth }} bits
              <v-tooltip location="top" :open-on-click="true" max-width="300">
                <template #activator="{ props }">
                  <v-icon class="ml-2" size="small" v-bind="props"
                    >mdi-information</v-icon
                  >
                </template>
                {{
                  $t("streamdetails.file_info.container", [
                    streamDetails.audio_format.content_type,
                  ])
                }}
                <br />
                {{
                  $t("streamdetails.file_info.codec", [
                    streamDetails.audio_format.codec_type,
                  ])
                }}
                <br />
                {{
                  $t("streamdetails.file_info.bit_depth", [
                    streamDetails.audio_format.bit_depth,
                  ])
                }}
                <br />
                {{
                  $t("streamdetails.file_info.sample_rate", [
                    (streamDetails.audio_format.sample_rate / 1000).toFixed(1),
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
              </v-tooltip>
            </div>
            <!-- Volume Normalization -->
            <div v-if="loudness" class="streamdetails-item">
              <img
                class="streamdetails-icon invert-on-light-mode"
                src="@/assets/level.png"
              />
              {{ loudness }}
              <v-tooltip location="top" :open-on-click="true" max-width="300">
                <template #activator="{ props }">
                  <v-icon class="ml-2" size="small" v-bind="props"
                    >mdi-information</v-icon
                  >
                </template>
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
                  v-if="streamDetails.volume_normalization_gain_correct != null"
                >
                  {{
                    $t(
                      "streamdetails.volume_normalization.applied_gain_correction",
                      [streamDetails.volume_normalization_gain_correct],
                    )
                  }}
                  <br />
                </span>
              </v-tooltip>
            </div>

            <template
              v-for="({ dsp, player_id, players }, index) in dsp_grouped"
              :key="index"
            >
              <!-- Separator -->
              <div class="d-flex">
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
                  class="streamdetails-separator flex-fill"
                  style="margin-left: 10px"
                ></div>
              </div>
              <!-- Input gain -->
              <div
                v-if="dsp.input_gain && dsp.input_gain != 0"
                class="streamdetails-item"
              >
                <img
                  class="streamdetails-icon invert-on-dark-mode"
                  src="@/assets/dsp.svg"
                />
                {{
                  $t("streamdetails.input_gain", [dsp.input_gain.toFixed(1)])
                }}
              </div>
              <!-- DSP -->
              <div
                v-if="dsp.state == DSPState.DISABLED_BY_UNSUPPORTED_GROUP"
                class="streamdetails-item"
              >
                <img
                  class="streamdetails-icon invert-on-dark-mode"
                  src="@/assets/dsp-disabled.svg"
                />
                {{ $t("streamdetails.dsp_unsupported") }}
                <v-tooltip location="top" :open-on-click="true" max-width="300">
                  <template #activator="{ props }">
                    <v-icon class="ml-2" size="small" v-bind="props"
                      >mdi-information</v-icon
                    >
                  </template>
                  {{ $t("streamdetails.dsp_disabled_by_unsupported_group") }}
                </v-tooltip>
              </div>
              <div
                v-for="(filter, i) in dsp.filters"
                v-else
                :key="i"
                class="streamdetails-item"
              >
                <img
                  class="streamdetails-icon invert-on-dark-mode"
                  src="@/assets/dsp.svg"
                />
                {{ dspFilterText(filter) }}
              </div>
              <!-- Output gain -->
              <div
                v-if="dsp.output_gain && dsp.output_gain != 0"
                class="streamdetails-item"
              >
                <img
                  class="streamdetails-icon invert-on-dark-mode"
                  src="@/assets/dsp.svg"
                />
                {{
                  $t("streamdetails.output_gain", [dsp.input_gain.toFixed(1)])
                }}
              </div>
              <!-- Output limiter-->
              <div v-if="dsp.output_limiter" class="streamdetails-item">
                <img
                  class="streamdetails-icon invert-on-dark-mode"
                  src="@/assets/dsp.svg"
                />
                {{ $t("streamdetails.output_limiter") }}
                <v-tooltip location="top" :open-on-click="true" max-width="300">
                  <template #activator="{ props }">
                    <v-icon class="ml-2" size="small" v-bind="props"
                      >mdi-information</v-icon
                    >
                  </template>
                  {{ $t("streamdetails.output_limiter_info") }}
                </v-tooltip>
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
                />
                {{
                  streamDetails.dsp[player_id].output_format.sample_rate / 1000
                }}
                kHz /
                {{ streamDetails.dsp[player_id].output_format.bit_depth }} bits
                <v-tooltip location="top" :open-on-click="true" max-width="300">
                  <template #activator="{ props }">
                    <v-icon class="ml-2" size="small" v-bind="props"
                      >mdi-information</v-icon
                    >
                  </template>
                  {{
                    $t("streamdetails.output_format_info", [
                      streamDetails.dsp[player_id].output_format.content_type,
                    ])
                  }}
                </v-tooltip>
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
                      :domain="api.players[player].provider"
                      :size="30"
                      class="streamdetails-icon"
                      :monochrome="true"
                    />
                    {{ api.players[player].display_name }}
                  </template>
                  <template v-else>
                    <!-- This should not happen -->
                    <v-icon class="streamdetails-icon"
                      >mdi-alert-circle-outline</v-icon
                    >
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
                    :domain="api.players[player_id].provider"
                    :size="30"
                    class="streamdetails-icon"
                    :monochrome="true"
                  />
                  <template v-if="players.length == 1">
                    {{ api.players[player_id].display_name }}
                  </template>
                  <template v-else>
                    {{ api.players[player_id].display_name }} +
                    {{ players.length - 1 }}
                    <v-tooltip location="top" max-width="300">
                      <template #activator="{ props }">
                        <v-icon class="ml-2" size="small" v-bind="props"
                          >mdi-information</v-icon
                        >
                      </template>
                      {{ $t("streamdetails.click_to_expand") }}
                    </v-tooltip>
                  </template>
                </template>
                <template v-else>
                  <!-- This should not happen -->
                  <v-icon class="streamdetails-icon"
                    >mdi-alert-circle-outline</v-icon
                  >
                  Player not found
                </template>
              </div>
            </template>
          </div>
        </div>
      </v-list>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import {
  ContentType,
  DSPFilter,
  DSPFilterType,
  DSPState,
  VolumeNormalizationMode,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

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
  let grouped = [];
  for (const [player_id, dsp] of Object.entries(streamDetails.value.dsp)) {
    let identical_dsp = grouped.find(
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
  LOW = 0,
  GOOD = 1,
  HIRES = 3,
}

const isContentTypeLossless = function (contentType: ContentType) {
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

const inputQualityTier = computed(() => {
  const sd = streamDetails.value;
  if (!sd) return QualityTier.LOW;

  let content_type = sd.audio_format.content_type;
  if (sd.audio_format.codec_type !== ContentType.UNKNOWN) {
    // Prefer making this decision based on codec type
    content_type = sd.audio_format.codec_type;
  }

  if (sd.audio_format.bit_depth > 16 || sd.audio_format.sample_rate > 48000) {
    return QualityTier.HIRES;
  } else if (isContentTypeLossless(content_type)) {
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
    // Default to good/lossless
    let player_tier = QualityTier.GOOD;
    if (
      dsp.output_format &&
      (dsp.output_format.bit_depth > 16 ||
        dsp.output_format.sample_rate > 48000)
    ) {
      player_tier = QualityTier.HIRES;
    }
    if (
      dsp.output_format &&
      dsp.output_format.content_type == ContentType.MP3
    ) {
      // MP3 is always low quality
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
    case QualityTier.HIRES:
      return "cyan";
  }
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

export const imgCoverDark = new URL("@/assets/cover_dark.png", import.meta.url)
  .href;
export const imgCoverLight = new URL(
  "@/assets/cover_light.png",
  import.meta.url,
).href;
export const iconFolder = new URL("@/assets/folder.svg", import.meta.url).href;
</script>

<style>
.list-item {
  padding: 0px 8px 0px 8px !important;
}

.list-item > div.ListItem__prepend {
  padding-right: 10px;
}

.mediadetails-streamdetails {
  width: 30px;
  height: 14px;
  border-radius: 2px;
  font-size: x-small;
  font-weight: 800;
  min-width: 55px;
  padding: 0;
  box-shadow: none;
}

.mediadetails-content-type-btn {
  height: 25px !important;
  padding: 7px !important;
  font-weight: 500;
  font-size: 10px !important;
  letter-spacing: 0.1em;
  border-radius: 2px;
  margin: 0px;
}

.streamdetails-item {
  height: 50px;
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

.streamdetails-icon {
  height: 30px;
  width: 50px;
  contain: contain;
  object-fit: contain;
}

.invert-on-light-mode {
  filter: none;
}

.v-theme--light .invert-on-light-mode {
  filter: invert(100%);
}

.invert-on-dark-mode {
  filter: none;
}

.v-theme--dark .invert-on-dark-mode {
  filter: invert(100%);
}

.streamdetails-separator {
  height: 12.5px;
  display: flex;
  align-items: center;
  margin-top: 12.5px;
  border-style: dotted;
  border-width: 1px;
  border-bottom: none;
  border-left: none;
  border-right: none;
}

.line-space {
  height: 50px;
  width: 16px;
}

.line-space-halve {
  height: 25px;
  width: 16px;
}

.line-start {
  border-top-left-radius: 12.5px;
  height: 25px;
  width: 16px;
  margin-top: 25px;
  margin-left: 8px;
  border-width: 1px;
  border-style: solid;
  border-bottom: none;
  border-right: none;
}

.line-branch-start-left {
  height: 25px;
  width: 16px;
}

.line-branch-start-left::before {
  content: "";
  height: 14px; /* + 2 * 1px border */
  width: 14px; /* + 2 * 1px border */
  border-width: 1px;
  border-style: solid;
  border-bottom: none;
  border-right: none;
  margin-top: 11px; /* -1 since the border is 1px */
  border-top-left-radius: 12px;
  margin-left: 8px;
  position: absolute;
}

.line-branch-start-right {
  height: 25px;
  width: 16px;
  margin-left: 8px;
  border-left-width: 1px;
  border-left-style: solid;
  border-top: none;
  border-right: none;
  border-bottom: none;
}

.line-branch-start-right::before {
  content: "";
  height: 12px;
  width: 12px;
  border-width: 1px;
  border-style: solid;
  border-left: none;
  border-top: none;
  border-bottom-right-radius: 12px;
  transform: translate(-100%, 0%);
  position: absolute;
}

.line-branch-split-left {
  height: 25px;
  width: 8px;
  border-style: solid;
  border-width: 1px;
  border-right: none;
  border-top: none;
  border-bottom: none;
  margin-left: 8px;
}

.line-branch-split-left::before {
  content: "";
  height: 12px;
  width: 12px;
  border-width: 1px;
  border-style: solid;
  border-top: none;
  border-right: none;
  border-bottom-left-radius: 12px;
  position: absolute;
  transform: translate(-1px, 0); /* -1 since the border is 1px */
}

.line-branch-output {
  height: 50px;
  width: 16px;
  margin-left: 8px;
  border-left-width: 1px;
  border-left-style: solid;
  border-top: none;
  border-right: none;
  border-bottom: none;
}

.line-branch-output::before {
  content: "";
  height: 25px;
  width: 16px;
  border-width: 1px;
  border-style: solid;
  border-top: none;
  border-right: none;
  border-bottom-left-radius: 12.5px;
  position: absolute;
  transform: translate(-1px, 0); /* -1 since the border is 1px */
}

.line-branch-end-left {
  height: 25px;
  width: 8px;
  margin-left: 8px;
}

.line-branch-end-left::before {
  content: "";
  height: 12px;
  width: 12px;
  border-width: 1px;
  border-style: solid;
  border-top: none;
  border-right: none;
  border-bottom-left-radius: 12px;
  position: absolute;
}

.line-branch-rejoin-right {
  height: 25px;
  width: 8px;
  margin-left: 8px;
}

.line-branch-rejoin-right::before {
  content: "";
  height: 14px; /* + 2 * 1px border */
  width: 14px; /* + 2 * 1px border */
  border-width: 1px;
  border-style: solid;
  border-bottom: none;
  border-left: none;
  margin-left: 1px;
  margin-top: 11px; /* -1 since the border is 1px */
  border-top-right-radius: 12px;
  position: absolute;
  transform: translate(-100%, 0%);
}

.line-end {
  border-bottom-left-radius: 12.5px;
  height: 25px;
  width: 16px;
  margin-bottom: 25px;
  margin-left: 8px;
  border-width: 1px;
  border-style: solid;
  border-top: none;
  border-right: none;
}

.line-straight {
  height: 50px;
  width: 16px;
  margin-left: 8px;
  border-left-width: 1px;
  border-left-style: solid;
  border-top: none;
  border-right: none;
  border-bottom: none;
}

.line-straight-halve {
  height: 25px;
  width: 16px;
  margin-left: 8px;
  border-left-width: 1px;
  border-left-style: solid;
  border-top: none;
  border-right: none;
  border-bottom: none;
}

.line-with-dot {
  height: 50px;
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
  margin-top: 25px;
  height: 14px;
  width: 14px;
  background-color: rgba(var(--v-theme-on-surface));
  border-radius: 50%;
}

.line-with-dot::after {
  content: "";
  position: absolute;
  transform: translate(-50%, -50%);
  margin-top: 25px;
  height: 10px;
  width: 10px;
  background-color: rgb(var(--v-theme-secondary));
  border-radius: 50%;
}

.quality-tier-dot {
  height: 8px;
  width: 8px;
  border-radius: 50%;
  margin: auto;
  margin-right: 10px;
}
</style>
