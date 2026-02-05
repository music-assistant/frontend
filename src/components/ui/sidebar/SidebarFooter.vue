<script setup lang="ts">
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";
import { useSidebar } from "./utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

const { isMobile } = useSidebar();
</script>

<template>
  <div
    data-slot="sidebar-footer"
    data-sidebar="footer"
    :class="
      cn(
        'flex flex-col gap-2 p-2',
        isMobile ? 'w-full' : 'ml-auto pb-26',
        props.class,
      )
    "
  >
    <slot></slot>
  </div>
</template>
