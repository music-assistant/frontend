<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <li
    data-slot="sidebar-menu-item"
    data-sidebar="menu-item"
    :class="
      cn(
        'group/menu-item relative w-full group-data-[collapsible=icon]:w-[40px]',
        props.class,
      )
    "
  >
    <slot></slot>
  </li>
</template>

<style>
[data-collapsible="icon"] [data-sidebar="menu-item"] > a {
  transition-duration: 0ms !important;
}
</style>
