<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <ul
    data-slot="sidebar-menu"
    data-sidebar="menu"
    :class="
      cn(
        'm-0 flex w-full min-w-0 list-none flex-col items-start gap-0 p-0 group-data-[collapsible=icon]:items-center md:gap-1',
        props.class,
      )
    "
  >
    <slot></slot>
  </ul>
</template>
