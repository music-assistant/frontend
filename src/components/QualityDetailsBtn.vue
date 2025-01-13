<template>
  <!-- streaming quality details -->
  <v-menu
    v-if="streamDetails"
    location="top center"
    :close-on-content-click="false"
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
    <v-card class="mx-auto" width="300">
      <v-list style="overflow: hidden">
        <v-list-item class="list-item list-item-main" :min-height="5">
          <v-card-title>
            {{ $t("stream_details") }}
          </v-card-title>
        </v-list-item>
        <v-divider />
        <div style="height: 50px; display: flex; align-items: center">
          <ProviderIcon
            :domain="streamDetails.provider"
            :size="35"
            style="object-fit: contain; margin-left: 10px; margin-right: 5px"
          />
          {{
            api.providerManifests[streamDetails.provider]?.name ||
            api.providers[streamDetails.provider]?.name
          }}
        </div>

        <div style="height: 50px; display: flex; align-items: center">
          <img
            height="30"
            width="50"
            :src="getContentTypeIcon(streamDetails.audio_format.content_type)"
            :style="
              $vuetify.theme.current.dark
                ? 'object-fit: contain;'
                : 'object-fit: contain;filter: invert(100%);'
            "
          />
          {{ streamDetails.audio_format.sample_rate / 1000 }} kHz /
          {{ streamDetails.audio_format.bit_depth }} bits
        </div>

        <div
          v-if="loudness"
          style="height: 50px; display: flex; align-items: center"
        >
          <img
            height="30"
            width="50"
            contain
            src="@/assets/level.png"
            :style="
              $vuetify.theme.current.dark
                ? 'object-fit: contain;'
                : 'object-fit: contain;filter: invert(100%);'
            "
          />
          {{ loudness }}
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
import { ContentType, VolumeNormalizationMode } from "@/plugins/api/interfaces";
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
const getContentTypeIcon = function (contentType: ContentType) {
  if (contentType == ContentType.AAC) return iconAac;
  if (contentType == ContentType.FLAC) return iconFlac;
  if (contentType == ContentType.MP3) return iconMp3;
  if (contentType == ContentType.MPEG) return iconMp3;
  if (contentType == ContentType.OGG) return iconOgg;
  if (contentType == ContentType.M4A) return iconM4a;
  return iconFallback;
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
</style>
