<script setup lang="ts">
import { cn } from "@/lib/utils";
import api from "@/plugins/api";
import type { HTMLAttributes } from "vue";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useSidebar } from "./utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

const route = useRoute();
const { isMobile, state } = useSidebar();
const isCollapsed = computed(() => state.value === "collapsed");

// Track whether footer is hidden on party route (no player controls)
const partyFooterHidden = ref(false);

watch(
  () => route.path,
  async (path) => {
    if (path === "/party") {
      try {
        const config = (await api.sendCommand("party_mode/config")) as {
          show_player_controls?: boolean;
        };
        partyFooterHidden.value = !(config?.show_player_controls ?? false);
      } catch {
        partyFooterHidden.value = true;
      }
    } else {
      partyFooterHidden.value = false;
    }
  },
  { immediate: true },
);

const needsBottomPadding = computed(
  () => !(route.path === "/party" && partyFooterHidden.value),
);
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
