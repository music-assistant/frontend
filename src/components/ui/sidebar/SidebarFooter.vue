<script setup lang="ts">
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";
import { computed } from "vue";
import { useSidebar } from "./utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

const { isMobile, state } = useSidebar();
const isCollapsed = computed(() => state.value === "collapsed");
</script>

<template>
  <div
    data-slot="sidebar-footer"
    data-sidebar="footer"
    :class="
      cn(
        'flex w-full shrink-0 flex-col justify-center gap-2',
        isMobile ? 'p-2' : isCollapsed ? 'pt-2 pb-2' : 'px-3 pt-2 pb-2',
        props.class,
      )
    "
  >
    <slot></slot>
  </div>
</template>
