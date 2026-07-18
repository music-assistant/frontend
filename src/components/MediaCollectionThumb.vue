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
        :scale="props.thumbScale as number"
        rounded
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MediaItemThumb from "./MediaItemThumb.vue";
import type { MediaCollection } from "@/plugins/api/interfaces";

interface Props {
  item: MediaCollection;
  size?: string | number;
  thumbScale?: string | number;
  thumbOffset?: string | number;
}

const props = withDefaults(defineProps<Props>(), {
  size: "100%",
  thumbScale: 0.8,
  thumbOffset: 19,
});

const visibleItems = computed(() => props.item.items.slice(0, 3));

function thumbStyle(index: number) {
  const count = visibleItems.value.length;
  const offset = props.thumbOffset as number;

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
