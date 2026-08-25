<script setup lang="ts">
import { Sheet, SheetContent } from "@/components/ui/sheet";
import SheetDescription from "@/components/ui/sheet/SheetDescription.vue";
import SheetHeader from "@/components/ui/sheet/SheetHeader.vue";
import SheetTitle from "@/components/ui/sheet/SheetTitle.vue";
import { useMobileSidebarSide } from "@/composables/useMobileSidebarSide";
import { cn } from "@/lib/utils";
import type { SidebarProps } from ".";
import { SIDEBAR_WIDTH_MOBILE, useSidebar } from "./utils";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(defineProps<SidebarProps>(), {
  side: "left",
  variant: "sidebar",
  collapsible: "offcanvas",
});

const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

const mobileSheetSide = useMobileSidebarSide();
</script>

<template>
  <div
    v-if="collapsible === 'none'"
    data-slot="sidebar"
    :class="
      cn(
        'bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col',
        props.class,
      )
    "
    v-bind="$attrs"
  >
    <slot></slot>
  </div>

  <Sheet
    v-else-if="isMobile"
    :open="openMobile"
    v-bind="$attrs"
    @update:open="setOpenMobile"
  >
    <SheetContent
      data-sidebar="sidebar"
      data-slot="sidebar"
      data-mobile="true"
      :side="mobileSheetSide"
      :class="[
        'sidebar-mobile-sheet bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden',
        `sidebar-mobile-sheet--${mobileSheetSide}`,
      ]"
      :style="{
        '--sidebar-width': SIDEBAR_WIDTH_MOBILE,
      }"
    >
      <SheetHeader class="sr-only">
        <SheetTitle>{{ $t("sidebar.title") }}</SheetTitle>
        <SheetDescription>{{ $t("sidebar.description") }}</SheetDescription>
      </SheetHeader>
      <div class="flex h-full w-full flex-col">
        <slot></slot>
      </div>
    </SheetContent>
  </Sheet>

  <div
    v-else
    class="group peer text-sidebar-foreground hidden md:block"
    data-slot="sidebar"
    :data-state="state"
    :data-collapsible="state === 'collapsed' ? collapsible : ''"
    :data-variant="variant"
    :data-side="side"
  >
    <!-- This is what handles the sidebar gap on desktop  -->
    <div
      :class="
        cn(
          'relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear',
          'group-data-[collapsible=offcanvas]:w-0',
          'group-data-[side=right]:rotate-180',
          variant === 'floating' || variant === 'inset'
            ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)',
        )
      "
    ></div>
    <div
      :class="
        cn(
          'fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex',
          side === 'left'
            ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
            : 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
          // Adjust the padding for floating and inset variants.
          variant === 'floating' || variant === 'inset'
            ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)',
          props.class,
        )
      "
      v-bind="$attrs"
    >
      <div
        data-sidebar="sidebar"
        class="bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm"
      >
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<style>
/* :root lifts these above the equally-!important size, padding and radius
   utilities the sheet carries */
:root .sidebar-mobile-sheet {
  /* The panel keeps the edge-to-edge span its own utilities give it, so its
     surface fills the strips the phone reserves for the status bar and the home
     indicator, and pads its contents back out of them. */
  border-radius: 0 !important;
  /* The widths below count that padding in. */
  box-sizing: border-box;
  padding-top: var(--device-inset-top) !important;
  padding-bottom: var(--device-inset-bottom) !important;
}

/* Widened by the inset they pad away, so the menu keeps its full width. */
:root .sidebar-mobile-sheet--left {
  width: calc(var(--sidebar-width) + var(--device-inset-left)) !important;
  padding-left: var(--device-inset-left) !important;
}

:root .sidebar-mobile-sheet--right {
  width: calc(var(--sidebar-width) + var(--device-inset-right)) !important;
  padding-right: var(--device-inset-right) !important;
}
</style>
