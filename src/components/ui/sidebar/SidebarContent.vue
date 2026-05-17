<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useSidebar } from "./utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

const el = ref<HTMLElement | null>(null);
const { state } = useSidebar();

let resizeObserver: ResizeObserver | null = null;
let mutationObserver: MutationObserver | null = null;

const updateScrollbarWidth = () => {
  if (!el.value) return;
  const sidebarEl = el.value.closest<HTMLElement>("[data-slot=sidebar]");
  if (!sidebarEl) return;

  const overflows =
    state.value === "collapsed" &&
    el.value.scrollHeight > el.value.clientHeight;

  if (overflows) {
    sidebarEl.style.setProperty("--sidebar-width-icon", "calc(3rem + 6px)");
    el.value.style.scrollbarGutter = "stable";
  } else {
    sidebarEl.style.removeProperty("--sidebar-width-icon");
    el.value.style.scrollbarGutter = "";
  }
};

watch(state, updateScrollbarWidth);

onMounted(() => {
  updateScrollbarWidth();

  resizeObserver = new ResizeObserver(updateScrollbarWidth);
  if (el.value) resizeObserver.observe(el.value);

  mutationObserver = new MutationObserver(updateScrollbarWidth);
  if (el.value)
    mutationObserver.observe(el.value, { childList: true, subtree: true });
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  mutationObserver?.disconnect();
});
</script>

<template>
  <div
    ref="el"
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
