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
        'flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-x-hidden',
        props.class,
      )
    "
  >
    <slot></slot>
  </div>
</template>

<style>
/* Collapsed sidebar: remove group padding so icons/images are not clipped */
[data-collapsible="icon"] [data-sidebar="group"][data-slot="sidebar-group"] {
  padding-right: 0 !important;
}

/* Collapsed sidebar: thin scrollbar */
[data-collapsible="icon"] [data-sidebar="content"] {
  scrollbar-width: thin;
}

[data-collapsible="icon"] [data-sidebar="content"]::-webkit-scrollbar {
  width: 4px;
}

[data-collapsible="icon"] [data-sidebar="content"]::-webkit-scrollbar-track {
  background: transparent;
}

[data-collapsible="icon"] [data-sidebar="content"]::-webkit-scrollbar-thumb {
  background-color: rgba(128, 128, 128, 0.35);
  border-radius: 2px;
}
</style>
