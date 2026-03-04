<script setup lang="ts">
import { usePartyModeConfig } from "@/composables/usePartyModeConfig";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";
import { computed, watch } from "vue";
import { useRoute } from "vue-router";
import { useSidebar } from "./utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

const route = useRoute();
const { isMobile, state } = useSidebar();
const isCollapsed = computed(() => state.value === "collapsed");

const { config: partyConfig, fetchConfig } = usePartyModeConfig();

watch(
  () => route.path,
  async (path) => {
    if (path === "/party") {
      await fetchConfig();
    }
  },
  { immediate: true },
);

const needsBottomPadding = computed(() => {
  if (route.path !== "/party") return true;
  return partyConfig.value?.show_player_controls ?? false;
});
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
            ? needsBottomPadding
              ? 'pl-[1px] pt-2 pb-26'
              : 'pl-[1px] pt-2'
            : needsBottomPadding
              ? 'px-3 pt-2 pb-26'
              : 'px-3 pt-2',
        props.class,
      )
    "
  >
    <slot></slot>
  </div>
</template>
