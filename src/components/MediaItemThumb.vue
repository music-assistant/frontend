<template>
  <v-img
    ref="imageTag"
    loading="lazy"
    :height="size || '100%'"
    :width="size || '100%'"
    aspect-ratio="1"
    :src="imgData"
    :class="{ rounded: rounded }"
    contain
    :lazy-src="theme.current.value.dark ? imgCoverDark : imgCoverLight"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type {
  ItemMapping,
  MediaItemImage,
  MediaItemType,
  QueueItem,
} from '@/plugins/api/interfaces';
import { ImageType, MediaType } from '@/plugins/api/interfaces';
import { api } from '@/plugins/api';
import { useTheme } from 'vuetify';
import {
  imgCoverDark,
  imgCoverLight,
  iconFolder,
} from '@/components/QualityDetailsBtn.vue';
import { store } from '@/plugins/store';

export interface Props {
  item?: MediaItemType | ItemMapping | QueueItem;
  size?: string | number;
  fallback?: string;
  rounded?: boolean;
  thumbnail?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  item: undefined,
  size: '100%',
  fallback: undefined,
  rounded: true,
  thumbnail: true,
});

const theme = useTheme();

function getThumbSize() {
  if (typeof props.size == 'number') {
    return props.size;
  } else if (props.thumbnail) return 256;
  else return 0;
}
const thumbSize = getThumbSize();

function getFallbackImage() {
  if (props.fallback) return props.fallback;
  if (
    props.item &&
    'media_type' in props.item &&
    props.item.media_type == MediaType.FOLDER
  )
    return iconFolder;
  if (!props.item) return '';
  if (!props.item.name) return '';
  if (store.allowExternalImageRetrieval)
    return getAvatarImage(
      props.item.name,
      theme.current.value.dark,
      thumbSize || 256,
    );
  return theme.current.value.dark ? imgCoverDark : imgCoverLight;
}
const fallbackImage = getFallbackImage();

const imgData = computed(() =>
  props.item
    ? getImageThumbForItem(props.item, ImageType.THUMB, thumbSize) ||
      fallbackImage
    : fallbackImage,
);
</script>

<script lang="ts">
//// utility functions for images

export const getAvatarImage = function (
  name: string,
  dark = false,
  size = 256,
): string {
  // get url to avatar image for a string or sentence
  if (dark)
    return `https://ui-avatars.com/api/?name=${name}&size=${
      size || 256
    }&bold=true&background=1d1d1d&color=383838`;
  else
    return `https://ui-avatars.com/api/?name=${name}&size=${
      size || 256
    }&bold=true&background=a0a0a0&color=cccccc`;
};

export const getMediaItemImage = function (
  mediaItem?: MediaItemType | ItemMapping | QueueItem,
  type: ImageType = ImageType.THUMB,
  includeFileBased = false,
): MediaItemImage | undefined {
  // get imageurl for mediaItem
  if (!mediaItem) return undefined;

  // handle image in queueitem or itemmapping
  if ('image' in mediaItem && mediaItem.image && mediaItem.image.type == type)
    return mediaItem.image;
  if ('media_item' in mediaItem && mediaItem.media_item)
    return getMediaItemImage(mediaItem.media_item);

  // always prefer album image for tracks
  if ('album' in mediaItem && mediaItem.album) {
    const albumImage = getMediaItemImage(
      mediaItem.album,
      type,
      includeFileBased,
    );
    if (albumImage) return albumImage;
  }

  // handle regular image within mediaitem
  if ('metadata' in mediaItem && mediaItem.metadata.images) {
    for (const img of mediaItem.metadata.images) {
      if (!img.remotely_accessible && !includeFileBased) continue;
      if (img.type == type) return img;
    }
  }

  // retry with album/track artist(s)
  if ('artists' in mediaItem && mediaItem.artists) {
    for (const artist of mediaItem.artists) {
      const artistImage = getMediaItemImage(artist, type, includeFileBased);
      if (artistImage) return artistImage;
    }
  }

  // allow landscape fallback
  if (type == ImageType.THUMB) {
    return getMediaItemImage(mediaItem, ImageType.LANDSCAPE, includeFileBased);
  }
};

export const getImageThumbForItem = function (
  mediaItem?: MediaItemType | ItemMapping | QueueItem,
  type: ImageType = ImageType.THUMB,
  size?: number,
  preferImageProxy: boolean = false,
): string | undefined {
  if (!mediaItem) return;
  // find image in mediaitem
  const img = getMediaItemImage(mediaItem, type, true);
  if (!img || !img.path) return undefined;
  const checksum =
    'metadata' in mediaItem ? mediaItem.metadata?.cache_checksum : '';
  if (
    !img.remotely_accessible ||
    !store.allowExternalImageRetrieval ||
    preferImageProxy
  ) {
    // force imageproxy if image is not remotely accessible or we need a resized thumb
    const encUrl = encodeURIComponent(encodeURIComponent(img.path));
    let imageUrl = `${api.baseUrl}/imageproxy?path=${encUrl}&provider=${img.provider}&checksum=${checksum}`;
    if (size) return imageUrl + `&size=${size}`;
    return imageUrl;
  } else if (size) {
    // get url to resized image(thumb) from weserv service
    return `https://images.weserv.nl/?url=${img.path}&w=${size}&h=${size}&fit=cover&a=attention&checksum=${checksum}`;
  }
  // else: return image as-is
  return img.path;
};
</script>

<style scoped>
.v-avatar.v-avatar--density-default {
  height: 100% !important;
  width: 100% !important;
}
</style>
