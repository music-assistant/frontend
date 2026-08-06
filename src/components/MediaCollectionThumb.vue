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
        :scale="props.thumbScale"
        rounded
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MediaItemThumb from "./MediaItemThumb.vue";
import type { MediaCollection, MediaItemType } from "@/plugins/api/interfaces";

interface Props {
  item: MediaCollection<MediaItemType>;
  size?: string | number;
  thumbScale?: number;
  thumbOffset?: number;
}

const props = withDefaults(defineProps<Props>(), {
  size: "100%",
  thumbScale: 0.8,
  thumbOffset: 19,
});

const visibleItems = computed(() => props.item.items.slice(0, 3));

function thumbStyle(index: number) {
  const count = visibleItems.value.length;
  const offset = props.thumbOffset;

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
