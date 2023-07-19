<template>
  <div></div>
</template>

<script lang="ts">
import { ContentType, ProviderMapping } from '../plugins/api/interfaces';

export const iconFallback = new URL('@/assets/logo.png', import.meta.url).href;

export const iconAac = new URL('@/assets/aac.png', import.meta.url).href;
export const iconFlac = new URL('@/assets/flac.png', import.meta.url).href;
export const iconMp3 = new URL('@/assets/mp3.png', import.meta.url).href;
export const iconOgg = new URL('@/assets/ogg.png', import.meta.url).href;
export const iconVorbis = new URL('@/assets/vorbis.png', import.meta.url).href;
export const iconM4a = new URL('@/assets/m4a.png', import.meta.url).href;
export const iconHiRes = new URL('@/assets/hires.png', import.meta.url).href;

export const imgCoverDark = new URL('@/assets/cover_dark.png', import.meta.url).href;
export const imgCoverLight = new URL('@/assets/cover_light.png', import.meta.url).href;

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
    [ContentType.DSF, ContentType.FLAC, ContentType.AIFF, ContentType.WAV, ContentType.ALAC].includes(
      provDetails.audio_format.content_type,
    )
  ) {
    // lossless
    if (provDetails.audio_format.sample_rate > 48000 || provDetails.audio_format.bit_depth > 16) {
      // hi res
      return `Lossless Hi-Res ${provDetails.audio_format.content_type}`;
    }
    return `Lossless ${provDetails.audio_format.content_type}`;
  }
  return `Lossy ${provDetails.audio_format.content_type}`;
};
</script>
