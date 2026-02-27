<script setup lang="ts">
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useSidebar } from "./utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

const route = useRoute();
const { isMobile, state } = useSidebar();
const isCollapsed = computed(() => state.value === "collapsed");
const isPartyRoute = computed(() => route.path === "/party");
</script>

<template>
  <div
    data-slot="sidebar-footer"
    data-sidebar="footer"
    :class="
      cn(
        'flex w-full flex-col gap-2',
        isMobile
          ? 'p-2'
          : isCollapsed
            ? isPartyRoute
              ? 'pl-[1px] pt-2'
              : 'pl-[1px] pt-2 pb-26'
            : isPartyRoute
              ? 'px-3 pt-2'
              : 'px-3 pt-2 pb-26',
        props.class,
      )
    "
  >
    <slot></slot>
  </div>
</template>
