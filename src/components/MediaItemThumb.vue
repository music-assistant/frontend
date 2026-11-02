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
    :lazy-src="isDark ? imgCoverDark : imgCoverLight"
  >
    <div
      v-if="placeholderIcon"
      class="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground"
    >
      <component :is="placeholderIcon" class="size-[45%]" aria-hidden="true" />
    </div>
  </v-img>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type {
  ItemMapping,
  MediaItemType,
  QueueItem,
} from "@/plugins/api/interfaces";
import { ImageType, MediaType } from "@/plugins/api/interfaces";
import {
  imgCoverDark,
  imgCoverLight,
  iconFolder,
} from "@/components/QualityDetailsBtn.vue";
import { getMediaTypeIcon } from "@/helpers/media_type_icon";
import { getImageThumbForItem } from "@/helpers/utils";
import { useProviderIcon } from "@/composables/useProviderIcon";
import { isDark } from "@/composables/useThemePreference";
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

  return "";
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

// without any image, the media type's menu icon stands in for the artwork
const placeholderIcon = computed(() => {
  if (imgData.value || !props.item) return undefined;
  const mediaType =
    "media_type" in props.item
      ? props.item.media_type
      : props.item.media_item?.media_type;
  return getMediaTypeIcon(mediaType);
});
</script>

<style scoped>
.v-avatar.v-avatar--density-default {
  height: 100% !important;
  width: 100% !important;
}
</style>
