<template>
  <v-img
    loading="lazy"
    :height="size || '100%'"
    :width="size || '100%'"
    aspect-ratio="1"
    :src="imgData"
    :alt="alt ?? item?.name ?? ''"
    :class="{ rounded: rounded }"
    :style="imageStyle"
    contain
    :lazy-src="theme.current.value.dark ? imgCoverDark : imgCoverLight"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import type {
  ItemMapping,
  MediaItemType,
  QueueItem,
} from "@/plugins/api/interfaces";
import { ImageType, MediaType } from "@/plugins/api/interfaces";
import { useTheme } from "vuetify";
import {
  imgCoverDark,
  imgCoverLight,
  iconFolder,
} from "@/components/QualityDetailsBtn.vue";
import { getImageThumbForItem } from "@/helpers/utils";
import { useProviderIcon } from "@/composables/useProviderIcon";
import { getProviderRootDomain } from "@/plugins/api/helpers";

export interface Props {
  item?: MediaItemType | ItemMapping | QueueItem;
  size?: string | number;
  fallback?: string;
  rounded?: boolean;
  thumbnail?: boolean;
  scale?: number;
  alt?: string;
}

const props = withDefaults(defineProps<Props>(), {
  item: undefined,
  size: "100%",
  fallback: undefined,
  rounded: true,
  thumbnail: true,
  scale: 1,
  alt: undefined,
});

const theme = useTheme();

const imageStyle = computed(() => ({
  transform: `scale(${props.scale})`,
  transformOrigin: "bottom left",
}));

function getThumbSize() {
  if (typeof props.size === "number") {
    return props.size;
  } else if (props.thumbnail) {
    return 256;
  } else {
    return 0;
  }
}

const thumbSize = getThumbSize();

function getFallbackImage() {
  if (props.fallback) return props.fallback;

  if (
    props.item &&
    "media_type" in props.item &&
    props.item.media_type === MediaType.FOLDER
  ) {
    return iconFolder;
  }

  if (!props.item) return "";
  if (!props.item.name) return "";

  return getAvatarImage(
    props.item.name,
    theme.current.value.dark,
    thumbSize || 256,
  );
}

const fallbackImage = getFallbackImage();

// provider entries in the browse root show the provider icon
const { iconDataUri: providerIcon } = useProviderIcon(() =>
  getProviderRootDomain(props.item),
);

const imgData = computed(() =>
  props.item
    ? getImageThumbForItem(props.item, ImageType.THUMB, thumbSize) ||
      providerIcon.value ||
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
</script>

<style scoped>
.v-avatar.v-avatar--density-default {
  height: 100% !important;
  width: 100% !important;
}
</style>
