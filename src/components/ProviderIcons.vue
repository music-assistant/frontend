<template>
  <div class="provider-icons">
    <v-tooltip
      v-for="prov of uniqueProviders"
      :key="prov.prov_id"
      location="bottom"
    >
      <template #activator="{ props }">
        <v-btn icon v-bind="props" variant="plain">
          <IconBase
            v-bind="props"
            :key="prov.prov_type"
            :width="size || width"
            :height="size || height"
            class="provider-icon"
            :name="getProviderIcon(prov.prov_type)"
            :style="enableLink ? 'cursor: pointer' : ''"
            @click="enableLink ? provClicked(prov) : ''"
          />
        </v-btn>
      </template>
      <span>{{ $t('providers.' + prov.prov_type.toString()) }}</span>
    </v-tooltip>
  </div>
</template>

<script setup lang="ts">
import type { MediaItemProviderId } from '../plugins/api';
import { MediaQuality } from '../plugins/api';
import { computed } from 'vue';
import IconBase from './Icons/IconBase.vue';

// properties
export interface Props {
  providerIds: MediaItemProviderId[];
  height?: string;
  width?: string;
  size?: string;
  enableLink?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  height: '',
  width: '',
  size: '1.4em',
});

const uniqueProviders = computed(() => {
  const output: MediaItemProviderId[] = [];
  const keys: string[] = [];
  if (!props.providerIds) return [];
  props.providerIds.forEach(function (prov: MediaItemProviderId) {
    const key = prov.prov_type;
    if (keys.indexOf(key) === -1) {
      keys.push(key);
      output.push(prov);
    }
  });
  return output.sort((a, b) => a.prov_type.localeCompare(b.prov_type));
});

const provClicked = function (prov: MediaItemProviderId) {
  window.open(prov.url, '_blank');
};
</script>

<script lang="ts">
import { ContentType, ProviderType } from '../plugins/api';

export const iconHiRes = new URL('../assets/hires.png', import.meta.url).href;

export const getProviderIcon = function (provider: ProviderType) {
  if (provider == ProviderType.SPOTIFY) return 'spotify';
  if (provider == ProviderType.QOBUZ) return 'qobuz';
  if (provider == ProviderType.TUNEIN) return 'tunein';
  if (provider == ProviderType.YTMUSIC) return 'ytmusic';
  return 'filesystem';
};
export const getContentTypeIcon = function (contentType: ContentType) {
  if (contentType == ContentType.AAC) return 'aac';
  if (contentType == ContentType.FLAC) return 'flac';
  if (contentType == ContentType.MP3) return 'mp3';
  if (contentType == ContentType.MPEG) return 'mp3';
  if (contentType == ContentType.OGG) return 'ogg';
  if (contentType == ContentType.M4A) return 'm4a';
  return 'fallback';
};
export const getQualityIcon = function (quality?: MediaQuality) {
  if (!quality) return 'fallback';
  if (quality == MediaQuality.LOSSY_AAC) return 'aac';
  if (quality == MediaQuality.LOSSY_MP3) return 'mp3';
  if (quality == MediaQuality.LOSSY_OGG) return 'ogg';
  if (quality == MediaQuality.LOSSY_M4A) return 'm4a';
  if (quality >= MediaQuality.LOSSLESS) return 'flac';
  return 'fallback';
};

export const getQualityDesc = function (provDetails: MediaItemProviderId) {
  if (provDetails.details && !provDetails.details.includes('http')) {
    return provDetails.details;
  }
  if (!provDetails.quality) provDetails.quality = 0;
  if (provDetails.quality == MediaQuality.LOSSY_AAC) return 'Lossy aac';
  if (provDetails.quality == MediaQuality.LOSSY_MP3) return 'Lossy mp3';
  if (provDetails.quality == MediaQuality.LOSSY_OGG) return 'Lossy ogg';
  if (provDetails.quality == MediaQuality.LOSSY_M4A) return 'Lossy m4a';
  if (provDetails.quality > MediaQuality.LOSSLESS) return 'Lossless Hi-Res';
  if (provDetails.quality >= MediaQuality.LOSSLESS) return 'Lossless';
  return 'Unknown media quality ';
};
</script>

<style scoped>
.provider-icons {
  vertical-align: middle;
  align-items: center;
  padding: 0px;
}

.provider-icon {
  float: inherit;
  display: flex;
  margin: 5px;
}
</style>
