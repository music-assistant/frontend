<script setup lang="ts">
import { cn } from "@/lib/utils";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { store } from "@/plugins/store";
import { defaultDocument, useVModel } from "@vueuse/core";
import { TooltipProvider } from "reka-ui";
import { useHotkey, type RegisterableHotkey } from "@tanstack/vue-hotkeys";
import type { HTMLAttributes, Ref } from "vue";
import { computed, ref } from "vue";
import {
  provideSidebarContext,
  SIDEBAR_COOKIE_MAX_AGE,
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_KEYBOARD_SHORTCUT,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
} from "./utils";

const props = withDefaults(
  defineProps<{
    defaultOpen?: boolean;
    open?: boolean;
    class?: HTMLAttributes["class"];
  }>(),
  {
    defaultOpen: !defaultDocument?.cookie.includes(
      `${SIDEBAR_COOKIE_NAME}=false`,
    ),
    open: undefined,
    class: undefined,
  },
);

const emits = defineEmits<{
  "update:open": [open: boolean];
}>();

// a phone on its side has the width for a sidebar and none of the height, so
// the sidebar goes wherever the screen is phone-sized rather than merely narrow.
// A tablet is measured here rather than taken at its word, which is why this is
// not store.mobileLayout: one with the room for a sidebar keeps it, and a narrow
// one in portrait folds it away
const isMobile = computed(
  () => isPhoneSizedScreen() || !!store.forceMobileLayout,
);
const openMobile = ref(false);

const open = useVModel(props, "open", emits, {
  defaultValue: props.defaultOpen ?? false,
  passive: (props.open === undefined) as false,
}) as Ref<boolean>;

function setOpen(value: boolean) {
  open.value = value; // emits('update:open', value)

  // This sets the cookie to keep the sidebar state.
  document.cookie = `${SIDEBAR_COOKIE_NAME}=${open.value}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
}

function setOpenMobile(value: boolean) {
  openMobile.value = value;
}

// Helper to toggle the sidebar.
function toggleSidebar() {
  return isMobile.value
    ? setOpenMobile(!openMobile.value)
    : setOpen(!open.value);
}

useHotkey(
  `Mod+${SIDEBAR_KEYBOARD_SHORTCUT.toUpperCase()}` as RegisterableHotkey,
  toggleSidebar,
);

// We add a state so that we can do data-state="expanded" or "collapsed".
// This makes it easier to style the sidebar with Tailwind classes.
const state = computed(() => (open.value ? "expanded" : "collapsed"));

provideSidebarContext({
  state,
  open,
  setOpen,
  isMobile,
  openMobile,
  setOpenMobile,
  toggleSidebar,
});
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <div
      data-slot="sidebar-wrapper"
      :style="{
        '--sidebar-width': SIDEBAR_WIDTH,
        '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
      }"
      :class="
        cn(
          'group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full',
          props.class,
        )
      "
      v-bind="$attrs"
    >
      <slot></slot>
    </div>
  </TooltipProvider>
</template>
