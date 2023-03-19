<template>
  <div class="provider-icons" :style="`height: ${height};`">
    <v-menu
      location="bottom end"
      @click:outside.stop
      v-for="providerDomain of uniqueProviders"
      :key="providerDomain"
    >
      <template #activator="{ props }">
        <img
          v-bind="props"
          :key="providerDomain"
          class="provider-icon"
          :height="height"
          :src="getProviderIcon(providerDomain)"
          :style="enableDetails == true ? 'cursor: pointer' : ''"
        />
      </template>
      <v-card class="mx-auto" min-width="300" v-if="enableDetails">
        <v-list style="overflow: hidden">
          <span class="text-h5" style="padding: 10px">{{
            $t("provider_details")
          }}</span>
          <div
            v-for="mapping of providerMappings.filter(
              (x) => x.provider_domain == providerDomain
            )"
          >
            <v-divider />
            <!-- provider icon + name -->
            <div style="height: 50px; display: flex; align-items: center">
              <img
                height="30"
                width="50"
                center
                :src="getProviderIcon(providerDomain)"
                style="object-fit: contain"
              />
              {{
                truncateString(
                  api.providers[mapping.provider_instance]!.name,
                  25
                )
              }}
            </div>

            <!-- item ID -->
            <div style="height: 50px; display: flex; align-items: center">
              <v-icon
                size="40"
                icon="mdi-identifier"
                style="margin-left: 10px; padding-right: 10px"
              />
              {{ truncateString(mapping.item_id, 30) }}
            </div>

            <!-- link to web location of item (provider share link -->
            <div
              v-if="mapping.url && !mapping.provider_domain.includes('file')"
              style="height: 50px; display: flex; align-items: center"
            >
              <v-icon
                size="40"
                icon="mdi-share-outline"
                style="margin-left: 10px; padding-right: 5px"
              />
              <a :href="mapping.url" target="_blank">{{
                truncateString(mapping.url, 25)
              }}</a>
            </div>

            <!-- quality details -->
            <div style="height: 50px; display: flex; align-items: center">
              <img
                height="30"
                width="50"
                :src="getContentTypeIcon(mapping.content_type)"
                :style="
                  $vuetify.theme.current.dark
                    ? 'object-fit: contain;'
                    : 'object-fit: contain;filter: invert(100%);'
                "
              />
              {{ getQualityDesc(mapping) }}
            </div>

            <!-- track preview -->
            <div v-if="enablePreview">
              <div style="height: 50px; display: flex; align-items: center">
                <v-icon
                  icon="mdi-headphones"
                  size="40"
                  style="margin-left: 10px; padding-right: 15px"
                />
                Preview
              </div>
              <div
                style="
                  height: 50px;
                  display: flex;
                  align-items: center;
                  margin-left: 10px;
                  margin-right: 10px;
                "
                @mouseover="
                  fetchPreviewUrl(mapping.provider_domain, mapping.item_id)
                "
              >
                <audio
                  controls
                  :src="
                    previewUrls[`${mapping.provider_domain}.${mapping.item_id}`]
                  "
                />
              </div>
            </div>
          </div>
        </v-list>
      </v-card>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import type { ProviderMapping } from "../plugins/api/interfaces";
import { api } from "../plugins/api";
import { computed, reactive } from "vue";
import { truncateString } from "@/utils";

export interface Props {
  providerMappings: ProviderMapping[];
  height: number;
  enableDetails?: boolean;
  enablePreview?: boolean;
}
const props = defineProps<Props>();
const previewUrls = reactive<Record<string, string>>({});

// const uniqueProviders = computed(() => {
//   const output: ProviderMapping[] = [];
//   const keys: string[] = [];
//   if (!props.providerMappings) return [];
//   props.providerMappings.forEach(function (prov: ProviderMapping) {
//     const domain = prov.provider_domain;
//     if (
//       keys.indexOf(domain) === -1 &&
//       prov.provider_instance in api.providers
//     ) {
//       keys.push(domain);
//       output.push(prov);
//     }
//   });
//   return output.sort((a, b) =>
//     a.provider_domain.localeCompare(b.provider_domain)
//   );
// });

const uniqueProviders = computed(() => {
  const keys: string[] = [];
  if (!props.providerMappings) return [];
  props.providerMappings.forEach(function (prov: ProviderMapping) {
    const domain = prov.provider_domain;
    if (
      keys.indexOf(domain) === -1 &&
      prov.provider_instance in api.providers
    ) {
      keys.push(domain);
    }
  });
  return keys.sort();
});

const provClicked = function (prov: ProviderMapping) {
  window.open(prov.url, "_blank");
};

const fetchPreviewUrl = async function (provider: string, item_id: string) {
  const key = `${provider}.${item_id}`;
  if (key in previewUrls) return;
  const url = await api.getTrackPreviewUrl(provider, item_id);
  previewUrls[key] = url;
};
</script>

<script lang="ts">
import { ContentType } from "../plugins/api/interfaces";
export const iconSpotify = new URL("@/assets/spotify.png", import.meta.url)
  .href;
export const iconQobuz = new URL("@/assets/qobuz.png", import.meta.url).href;
export const iconFilesystem = new URL(
  "@/assets/filesystem.png",
  import.meta.url
).href;
export const iconTuneIn = new URL("@/assets/tunein.png", import.meta.url).href;
export const iconYTMusic = new URL("@/assets/ytmusic.png", import.meta.url)
  .href;
export const iconSlimProto = new URL("@/assets/slimproto.png", import.meta.url)
  .href;
export const iconAirPlay = new URL("@/assets/airplay.png", import.meta.url)
  .href;
export const iconChromeCast = new URL(
  "@/assets/chromecast.png",
  import.meta.url
).href;
export const iconSonos = new URL("@/assets/sonos.png", import.meta.url).href;
export const iconHass = new URL("@/assets/hass.png", import.meta.url).href;
export const iconDLNA = new URL("@/assets/dlna.png", import.meta.url).href;
export const iconFallback = new URL("@/assets/logo.png", import.meta.url).href;

export const iconAac = new URL("@/assets/aac.png", import.meta.url).href;
export const iconFlac = new URL("@/assets/flac.png", import.meta.url).href;
export const iconMp3 = new URL("@/assets/mp3.png", import.meta.url).href;
export const iconOgg = new URL("@/assets/ogg.png", import.meta.url).href;
export const iconVorbis = new URL("@/assets/vorbis.png", import.meta.url).href;
export const iconM4a = new URL("@/assets/m4a.png", import.meta.url).href;
export const iconHiRes = new URL("@/assets/hires.png", import.meta.url).href;

export const getProviderIcon = function (providerDomain: string) {
  if (providerDomain == "spotify") return iconSpotify;
  if (providerDomain == "qobuz") return iconQobuz;
  if (providerDomain == "tunein") return iconTuneIn;
  if (providerDomain == "ytmusic") return iconYTMusic;
  if (providerDomain == "slimproto") return iconSlimProto;
  if (providerDomain == "airplay") return iconAirPlay;
  if (providerDomain == "chromecast") return iconChromeCast;
  if (providerDomain == "sonos") return iconSonos;
  if (providerDomain == "hass") return iconHass;
  if (providerDomain == "dlna") return iconDLNA;
  if (providerDomain.includes("filesystem")) return iconFilesystem;
  return iconFallback;
};
export const getContentTypeIcon = function (contentType: ContentType) {
  if (contentType == ContentType.AAC) return iconAac;
  if (contentType == ContentType.FLAC) return iconFlac;
  if (contentType == ContentType.MP3) return iconMp3;
  if (contentType == ContentType.MPEG) return iconMp3;
  if (contentType == ContentType.OGG) return iconOgg;
  if (contentType == ContentType.M4A) return iconM4a;
  return iconFallback;
};

export const getQualityDesc = function (provDetails: ProviderMapping) {
  if (
    [
      ContentType.DSF,
      ContentType.FLAC,
      ContentType.AIFF,
      ContentType.WAV,
      ContentType.ALAC,
    ].includes(provDetails.content_type)
  ) {
    // lossless
    if (provDetails.sample_rate > 48000 || provDetails.bit_depth > 16) {
      // hi res
      return `Lossless Hi-Res ${provDetails.content_type}`;
    }
    return `Lossless ${provDetails.content_type}`;
  }
  return `Lossy ${provDetails.content_type}`;
};
</script>

<style scoped>
.provider-icons {
  width: auto;
  vertical-align: middle;
  align-items: center;
  padding: 0px;
}

.provider-icon {
  float: inherit;
  padding-left: 5px;
  display: flex;
  margin: 5px;
}
</style>
