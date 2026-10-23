<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <div
    data-slot="sidebar-content"
    data-sidebar="content"
    :class="
      cn(
        'flex min-h-0 flex-1 flex-col overflow-auto group-data-[collapsible=icon]:overflow-x-hidden',
        props.class,
      )
    "
  >
    <slot></slot>
  </div>
</template>

<style>
/* Collapsed sidebar: keep the icon rail full-width while retaining scrolling */
[data-collapsible="icon"] [data-sidebar="content"] {
  scrollbar-width: none;
}

[data-collapsible="icon"] [data-sidebar="content"]::-webkit-scrollbar {
  display: none;
}
</style>
