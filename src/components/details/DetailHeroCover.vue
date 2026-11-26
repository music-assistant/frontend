<template>
  <div
    class="size-full overflow-hidden rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
  >
    <MediaItemThumb :item="item" :rounded="false" />
  </div>
</template>

<script setup lang="ts">
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import type { MediaItemType } from "@/plugins/api/interfaces";

export interface Props {
  item: MediaItemType;
}
defineProps<Props>();
</script>
