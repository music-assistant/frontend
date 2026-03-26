<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <div
    data-slot="item-title"
    :class="
      cn(
        'flex items-center gap-2 text-sm leading-snug font-medium truncate',
        props.class,
      )
    "
  >
    <slot></slot>
  </div>
</template>
