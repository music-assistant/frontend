<template>
  <v-img
    :key="'uri' in item! ? item?.uri : item?.queue_item_id"
    :style="`height:${height};`"
    :cover="cover"
    :src="imgData"
    :width="width"
    :aspect-ratio="aspectRatio"
    @error="
      () => {
        imgData = fallbackImage;
      }
    "
  >
    <template #placeholder>
      <div class="d-flex align-center justify-center fill-height">
        <v-progress-circular
          indeterminate
        />
      </div>
    </template>
  </v-img>
</template>

<script setup lang="ts">
import { watch, ref, computed } from "vue";
import type {
  ItemMapping,
  MediaItemImage,
  MediaItemType,
  QueueItem,
} from "../plugins/api/interfaces";
import { ImageType } from "../plugins/api/interfaces";
import { api } from "../plugins/api";
import { useTheme } from "vuetify";

export interface Props {
  item?: MediaItemType | ItemMapping | QueueItem;
  width?: string | number;
  height?: string | number;
  aspectRatio?: string | number;
  cover?: boolean;
  fallback?: string;
  thumb?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  item: undefined,
  width: "100%",
  height: "auto",
  aspectRatio: "1/1",
  cover: true,
  fallback: undefined,
  thumb: true
});

const imgData = ref<string>();
const theme = useTheme();

const fallbackImage = computed(() => {
  if (props.fallback) return props.fallback;
  if (!props.item) return "";

  if (theme.current.value.dark)
    return `https://ui-avatars.com/api/?name=${props.item.name}&size=${thumbSize.value || 256}&bold=true&background=1d1d1d&color=383838`;
  else
    return `https://ui-avatars.com/api/?name=${props.item.name}&size=${thumbSize.value || 256}&bold=true&background=a0a0a0&color=cccccc`;
});

const thumbSize = computed(() => {
  if (typeof props.width == 'number') return props.width;
  else if (props.thumb) return 256;
  return 0
});

watch(
  () => props.item,
  async (newVal) => {
    if (newVal) {
      imgData.value =
        (getImageThumbForItem(newVal, ImageType.THUMB, thumbSize.value)) ||
        fallbackImage.value;
    }
  },
  { immediate: true }
);
</script>

<script lang="ts">
//// utility functions for images

export const getMediaItemImage = function (
  mediaItem?: MediaItemType | ItemMapping | QueueItem,
  type: ImageType = ImageType.THUMB,
  includeFileBased = false
): MediaItemImage | undefined {
  // get imageurl for mediaItem
  if (!mediaItem) return undefined;
  if ("image" in mediaItem && mediaItem.image) return mediaItem.image;
  if ("metadata" in mediaItem && mediaItem.metadata.images) {
    for (const img of mediaItem.metadata.images) {
      if (img.provider == 'http' && !includeFileBased) continue;
      if (img.type == type) return img;
    }
  }
  // retry with album of track
  if (
    "album" in mediaItem &&
    mediaItem.album &&
    "metadata" in mediaItem.album &&
    mediaItem.album.metadata &&
    mediaItem.album.metadata.images
  ) {
    for (const img of mediaItem.album.metadata.images) {
      if (img.provider == 'http' && !includeFileBased) continue;
      if (img.type == type) return img;
    }
  }
  // retry with album artist
  if (
    "artist" in mediaItem &&
    "metadata" in mediaItem.artist &&
    mediaItem.artist.metadata &&
    mediaItem.artist.metadata.images
  ) {
    for (const img of mediaItem.artist.metadata.images) {
      if (img.provider == 'http' && !includeFileBased) continue;
      if (img.type == type) return img;
    }
  }
  // retry with track artist
  if ("artists" in mediaItem && mediaItem.artists) {
    for (const artist of mediaItem.artists) {
      if ("metadata" in artist && artist.metadata.images) {
        for (const img of artist.metadata.images) {
          if (img.provider == 'http' && !includeFileBased) continue;
          if (img.type == type) return img;
        }
      }
    }
  }
};

export const getImageThumbForItem = function (
  mediaItem?: MediaItemType | ItemMapping | QueueItem,
  type: ImageType = ImageType.THUMB,
  size?: number
): string | undefined {
  if (!mediaItem) return;
  let imageUrl = "";
  // find image in mediaitem
  const img = getMediaItemImage(mediaItem, type, true);
  if (!img) return undefined;
  if (img.provider !== 'url') {
    // use imageproxy for embedded images
    const encUrl = encodeURIComponent(encodeURIComponent(img.path));
    const checksum =
      "metadata" in mediaItem ? mediaItem.metadata?.checksum : "";
    return `${api.baseUrl}/imageproxy?size=${
      size || 0
    }&path=${encUrl}&provider=${img.provider}&checksum=${checksum}`;
  }
  imageUrl = img.path;
  
  if (!size) {
    return imageUrl;
  } else if (imageUrl.includes('imageproxy')) {
    return imageUrl + `&size=${size}`;
  } else {
    // get url to resized image(thumb) from weserv service
    return `https://images.weserv.nl/?url=${imageUrl}&w=${size}&h=${size}&fit=cover&a=attention`;
  }
};
</script>

<style>
.v-avatar.v-avatar--density-default {
  height: 100% !important;
  width: 100% !important;
}
</style>
