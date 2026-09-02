<script setup lang="ts">
import { cn } from "@/lib/utils";
import logoSvg from "@/assets/icon.svg?raw";
import type { HTMLAttributes } from "vue";

const props = withDefaults(
  defineProps<{
    size?: number;
    class?: HTMLAttributes["class"];
  }>(),
  {
    size: 34,
    class: undefined,
  },
);
</script>

<template>
  <div
    :class="cn('flex shrink-0 items-center', props.class)"
    :style="{ width: `${props.size}px`, height: `${props.size}px` }"
    role="img"
    aria-label="Music Assistant"
    title="Music Assistant"
  >
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div class="size-full" v-html="logoSvg"></div>
  </div>
</template>

<style scoped>
:deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
