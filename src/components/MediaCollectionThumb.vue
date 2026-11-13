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
      :key="index"
      class="thumb"
      :style="thumbStyle(index)"
    >
      <MediaItemThumb
        :item="mediaItem"
        size="100%"
        :scale="thumbScale"
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

// the server picks the covers over all items, so a filtered listing keeps them;
// without any, the collection itself shows a placeholder
const visibleItems = computed(() => {
  const covers = (props.item.metadata.images ?? []).filter(
    (image) => image.type === ImageType.THUMB,
  );
  if (!covers.length) return [props.item];
  return covers.map((image) => ({ ...props.item, image }));
});

const thumbScale = computed(() => {
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
