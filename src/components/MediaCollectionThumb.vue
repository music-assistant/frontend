<template>
  <div
    class="thumb-stack"
    :style="{
      width: props.size,
      height: props.size,
    }"
  >
    <div
      v-for="(mediaItem, index) in visibleItems"
      :key="mediaItem.item_id ?? index"
      class="thumb"
      :style="thumbStyle(index)"
    >
      <MediaItemThumb
        :item="mediaItem"
        size="100%"
        :scale="collectionThumbScale"
        rounded
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MediaItemThumb from "./MediaItemThumb.vue";
import {
  ImageType,
  type MediaCollection,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { getImageThumbForItem } from "@/helpers/utils";

interface Props {
  item: MediaCollection<MediaItemType>;
  size?: string | number;
  thumbScale?: number;
  thumbOffset?: number;
}

const props = withDefaults(defineProps<Props>(), {
  size: "100%",
  thumbScale: 1,
  thumbOffset: 19,
});

const visibleItems = computed(() => {
  const items = props.item.items;
  const withThumb = items.filter(
    (item) => getImageThumbForItem(item, ImageType.THUMB) !== undefined,
  );

  if (withThumb.length >= 3) {
    return withThumb.slice(0, 3);
  }

  // If there are fewer than 3 thumbnails, preserve order.
  return items.slice(0, 3);
});

const collectionThumbScale = computed(() => {
  // Do not scale a single image.
  const count = visibleItems.value.length;
  return props.thumbScale * (count === 1 ? 1 : 0.8);
});

function thumbStyle(index: number) {
  // Double the offset for two images. No offset for a single image.
  const count = visibleItems.value.length;
  const offset = props.thumbOffset * (count === 2 ? 2 : 1);
  return {
    zIndex: count - index,
    transform: `translate(${index * offset}px, -${index * offset}px)`,
    transformOrigin: "bottom left",
  };
}
</script>

<style scoped>
.thumb-stack {
  position: relative;
  aspect-ratio: 1;
}

.thumb {
  position: absolute;
  inset: 0;
}
</style>
