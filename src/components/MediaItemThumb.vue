<template>
  <v-img
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
import { computed } from "vue";
import type {
  ItemMapping,
  MediaItemImage,
  MediaItemType,
  QueueItem,
} from "@/plugins/api/interfaces";
import { ImageType, MediaType } from "@/plugins/api/interfaces";
import { api } from "@/plugins/api";
import { useTheme } from "vuetify";
import {
  imgCoverDark,
  imgCoverLight,
  iconFolder,
} from "@/components/QualityDetailsBtn.vue";

export interface Props {
  item?: MediaItemType | ItemMapping | QueueItem;
  size?: string | number;
  fallback?: string;
  rounded?: boolean;
  thumbnail?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  item: undefined,
  size: "100%",
  fallback: undefined,
  rounded: true,
  thumbnail: true,
});

const theme = useTheme();

function getThumbSize() {
  if (typeof props.size == "number") {
    return props.size;
  } else if (props.thumbnail) return 256;
  else return 0;
}
const thumbSize = getThumbSize();

function getFallbackImage() {
  if (props.fallback) return props.fallback;
  if (
    props.item &&
    "media_type" in props.item &&
    props.item.media_type == MediaType.FOLDER
  )
    return iconFolder;
  if (!props.item) return "";
  if (!props.item.name) return "";
  return getAvatarImage(
    props.item.name,
    theme.current.value.dark,
    thumbSize || 256,
  );
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
): MediaItemImage | undefined {
  // get imageurl for mediaItem
  if (!mediaItem) return undefined;

  // handle image in queueitem or itemmapping
  if (
    "image" in mediaItem &&
    mediaItem.image &&
    mediaItem.image.type == type &&
    imageProviderIsAvailable(mediaItem.image.provider)
  )
    return mediaItem.image;
  if ("media_item" in mediaItem && mediaItem.media_item)
    return getMediaItemImage(mediaItem.media_item);

  // always prefer album image for tracks
  if ("album" in mediaItem && mediaItem.album) {
    const albumImage = getMediaItemImage(mediaItem.album, type);
    if (albumImage) return albumImage;
  }

  // handle regular image within mediaitem
  if ("metadata" in mediaItem && mediaItem.metadata.images) {
    for (const img of mediaItem.metadata.images) {
      if (img.type == type && imageProviderIsAvailable(img.provider))
        return img;
    }
  }

  // retry with album/track artist(s)
  if ("artists" in mediaItem && mediaItem.artists) {
    for (const artist of mediaItem.artists) {
      const artistImage = getMediaItemImage(artist, type);
      if (artistImage) return artistImage;
    }
  }

  // allow landscape fallback
  if (type == ImageType.THUMB) {
    return getMediaItemImage(mediaItem, ImageType.LANDSCAPE);
  }
};

export const getImageURL = function (
  img: MediaItemImage,
  size?: number,
  checksum?: string,
): string {
  if (!checksum) checksum = "";
  if (!img || !img.path) return "";
  if (img.path.startsWith("data:image")) return img.path;
  if (
    !img.remotely_accessible ||
    size ||
    img.path.split("//")[0] != window.location.protocol
  ) {
    // force imageproxy if image is not remotely accessible or we need a resized thumb
    // Note that we play it safe here and always enforce the proxy if the schema is different
    const encUrl = encodeURIComponent(encodeURIComponent(img.path));
    let imageUrl = `${api.baseUrl}/imageproxy?path=${encUrl}&provider=${img.provider}&checksum=${checksum}`;
    if (size) return imageUrl + `&size=${size}`;
    return imageUrl;
  }
  // else: return image as-is
  return img.path;
};

export const getImageThumbForItem = function (
  mediaItem?: MediaItemType | ItemMapping | QueueItem,
  type: ImageType = ImageType.THUMB,
  size?: number,
): string | undefined {
  if (!mediaItem) return;
  // find image in mediaitem
  const img = getMediaItemImage(mediaItem, type);
  if (!img || !img.path) return undefined;
  const checksum =
    "metadata" in mediaItem ? mediaItem.metadata?.cache_checksum : "";
  return getImageURL(img, size, checksum);
};

const imageProviderIsAvailable = function (provider: string) {
  if (provider === "http" || provider === "builtin") return true;
  return api.getProvider(provider)?.available === true;
};
</script>

<style scoped>
.v-avatar.v-avatar--density-default {
  height: 100% !important;
  width: 100% !important;
}
</style>
