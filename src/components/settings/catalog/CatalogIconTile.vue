<template>
  <!-- the icon is only ever an image of a data URI -->
  <span
    class="flex shrink-0 items-center justify-center rounded-[24%] bg-white shadow-md ring-1 ring-black/5"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <img
      v-if="src"
      :src="src"
      alt=""
      class="size-[64%] object-contain"
      data-testid="catalog-icon-image"
    />
    <Blocks v-else class="size-1/2 text-slate-400" aria-hidden="true" />
  </span>
</template>

<script setup lang="ts">
import { Blocks } from "@lucide/vue";

interface Props {
  // the icon as a data URI, or null while it loads or when there is none
  src: string | null | undefined;
  size: number;
}

defineProps<Props>();
</script>
