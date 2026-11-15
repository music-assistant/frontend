<template>
  <!-- the icon is only ever an image of a data URI -->
  <span
    class="flex shrink-0 items-center justify-center rounded-[24%] shadow-md ring-1"
    :class="onDark ? 'bg-slate-600 ring-white/10' : 'bg-white ring-black/5'"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :data-tile="onDark ? 'dark' : 'light'"
    data-testid="catalog-icon-tile"
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
  // whether the icon is drawn in white only, so it needs a dark tile; the slate
  // keeps a black shape visible as well
  onDark?: boolean;
}

defineProps<Props>();
</script>
