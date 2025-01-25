<template>
  <!-- streaming quality details -->
  <v-menu
    v-if="streamDetails"
    location="top center"
    :close-on-content-click="false"
    scrim
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
        <div class="d-flex justify-center" style="width: 100%">
          {{ streamDetails.audio_format.content_type.toUpperCase() }}
        </div>
      </v-chip>
    </template>
    <v-card class="mx-auto" width="350">
      <v-list style="overflow: hidden">
        <div class="d-flex ml-2 mr-2">
          <!-- Second line showing audio stream shared by multiple players -->
          <div v-if="dsp_length >= 2">
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
              v-for="(dsp, player_id, index) in streamDetails.dsp"
              :key="player_id"
            >
              <!-- rejoin the original stream -->
              <div
                v-if="index == dsp_length - 1"
                class="line-branch-end-left"
              ></div>
              <div v-else-if="index > 0" class="line-branch-split-left"></div>
              <template v-if="index != dsp_length - 1">
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
                <!-- Player Provider-->
                <div class="line-straight"></div>
                <!-- Player-->
                <div class="line-straight"></div>
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
            <div v-if="dsp_length >= 2" class="line-branch-start-right"></div>
            <div v-else class="line-straight-halve"></div>
            <!-- Player -->
            <template
              v-for="(dsp, player_id, index) in streamDetails.dsp"
              :key="player_id"
            >
              <!-- rejoin the original stream -->
              <div v-if="index > 0" class="line-branch-rejoin-right"></div>
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
              <!-- Player Provider-->
              <div class="line-straight"></div>
              <!-- Player-->
              <div class="line-end"></div>
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
              Input
              <div
                class="streamdetails-separator flex-fill"
                style="margin-left: 10px"
              ></div>
            </div>
            <!-- Provider -->
            <div class="streamdetails-item">
              <ProviderIcon
                :domain="streamDetails.provider"
                :size="35"
                style="
                  object-fit: contain;
                  margin-left: 10px;
                  margin-right: 5px;
                "
              />
              {{
                api.providerManifests[streamDetails.provider]?.name ||
                api.providers[streamDetails.provider]?.name
              }}
            </div>
            <!-- Fileinfo -->
            <div class="streamdetails-item">
              <img
                class="streamdetails-icon"
                :src="
                  getContentTypeIcon(streamDetails.audio_format.content_type)
                "
              />
              {{ streamDetails.audio_format.sample_rate / 1000 }} kHz /
              {{ streamDetails.audio_format.bit_depth }} bits
            </div>
            <!-- Volume Normalization -->
            <div v-if="loudness" class="streamdetails-item">
              <img class="streamdetails-icon" src="@/assets/level.png" />
              {{ loudness }}
            </div>

            <template
              v-for="(dsp, player_id) in streamDetails.dsp"
              :key="player_id"
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
                      outputQualityTiers[player_id],
                    ),
                  }"
                ></div>
                {{ api.players[player_id]?.name || "Output" }}
                <div
                  class="streamdetails-separator flex-fill"
                  style="margin-left: 10px"
                ></div>
              </div>
              <!-- DSP -->
              <div
                v-if="dsp.state == DSPState.DISABLED_BY_UNSUPPORTED_GROUP"
                class="streamdetails-item"
              >
                <img class="streamdetails-icon" src="@/assets/DSP_off.png" />
                {{ $t("dsp_disabled_by_unsupported_group") }}
              </div>
              <div
                v-for="(filter, index) in dsp.filters"
                v-else
                :key="index"
                class="streamdetails-item"
              >
                <img class="streamdetails-icon" src="@/assets/DSP.png" />
                {{ $t("settings.dsp.types." + filter.type) }}
              </div>
              <!-- Player Provider -->
              <div v-if="streamDetails.dsp" class="streamdetails-item">
                <template v-if="api.players[player_id]">
                  <ProviderIcon
                    :domain="api.players[player_id].provider"
                    :size="35"
                    style="
                      object-fit: contain;
                      margin-left: 10px;
                      margin-right: 5px;
                    "
                  />
                  {{
                    api.providerManifests[api.players[player_id].provider]
                      ?.name ||
                    api.providers[api.players[player_id].provider]?.name
                  }}
                </template>
                <template v-else>
                  <!-- This should not happen -->
                  <v-icon class="streamdetails-icon"
                    >mdi-alert-circle-outline</v-icon
                  >
                  Player not found
                </template>
              </div>
              <!-- Player -->
              <div v-if="streamDetails.dsp" class="streamdetails-item">
                <template v-if="api.players[player_id]">
                  <v-icon class="streamdetails-icon">mdi-speaker</v-icon>
                  {{ api.players[player_id].name }}
                </template>
                <template v-else>
                  <!-- This should not happen -->
                  <v-icon class="streamdetails-icon"
                    >mdi-alert-circle-outline</v-icon
                  >
                  {{ player_id }}
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
import { computed } from "vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import {
  ContentType,
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

  if (
    (sd.volume_normalization_mode == VolumeNormalizationMode.MEASUREMENT_ONLY ||
      sd.volume_normalization_mode ==
        VolumeNormalizationMode.FALLBACK_FIXED_GAIN ||
      sd.volume_normalization_mode ==
        VolumeNormalizationMode.FALLBACK_DYNAMIC) &&
    sd.loudness !== null
  ) {
    if (sd.prefer_album_loudness && sd.loudness_album !== null) {
      return $t("loudness_measurement_album", [sd.loudness_album?.toFixed(2)]);
    } else {
      return $t("loudness_measurement", [sd.loudness?.toFixed(2)]);
    }
  } else if (
    sd.volume_normalization_mode == VolumeNormalizationMode.DYNAMIC ||
    sd.volume_normalization_mode == VolumeNormalizationMode.FALLBACK_DYNAMIC
  ) {
    return $t("loudness_dynamic");
  } else if (
    sd.volume_normalization_mode == VolumeNormalizationMode.FIXED_GAIN ||
    sd.volume_normalization_mode == VolumeNormalizationMode.FALLBACK_FIXED_GAIN
  ) {
    return $t("loudness_fixed");
  } else {
    return null;
  }
});
const dsp_length = computed(() => {
  return streamDetails.value?.dsp
    ? Object.keys(streamDetails.value.dsp).length
    : 0;
});
const getContentTypeIcon = function (contentType: ContentType) {
  if (contentType == ContentType.AAC) return iconAac;
  if (contentType == ContentType.FLAC) return iconFlac;
  if (contentType == ContentType.MP3) return iconMp3;
  if (contentType == ContentType.MPEG) return iconMp3;
  if (contentType == ContentType.OGG) return iconOgg;
  if (contentType == ContentType.M4A) return iconM4a;
  return iconFallback;
};

enum QualityTier {
  LOW = 0,
  GOOD = 1,
  HIRES = 3,
}

const inputQualityTier = computed(() => {
  const sd = streamDetails.value;
  if (!sd) return QualityTier.LOW;

  if (sd.audio_format.bit_depth > 16 || sd.audio_format.sample_rate > 48000) {
    return QualityTier.HIRES;
  } else if (
    [
      ContentType.FLAC,
      ContentType.ALAC,
      ContentType.WAV,
      ContentType.AIFF,
      ContentType.PCM_S16LE,
      ContentType.PCM_S24LE,
      ContentType.PCM_S32LE,
      ContentType.PCM_F32LE,
      ContentType.PCM_F64LE,
      ContentType.DSF,
      // FIXME: this and ContentType.is_lossless (in server repo) assumes that wavpack is lossless,
      // and m4a/m4b is lossy. This is not always true.
      ContentType.WAVPACK,
    ].includes(sd.audio_format.content_type)
  ) {
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
    // TODO: finish
    tiers[player_id] = QualityTier.HIRES;
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
  width: 50px !important;
  padding: 5px !important;
  font-weight: 500;
  font-size: 10px !important;
  letter-spacing: 0.1em;
  border-radius: 2px;
  margin-left: 5px;
  flex-flow: column;
  margin: 0px;
}

.streamdetails-item {
  height: 50px;
  display: flex;
  align-items: center;
}

.streamdetails-icon {
  height: 30px;
  width: 50px;
  contain: contain;
  object-fit: contain;
}

.v-theme--dark .streamdetails-icon {
  filter: none;
}

.v-theme--light .streamdetails-icon:not(.v-icon) {
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
