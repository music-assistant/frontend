<script setup lang="ts">
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";
import { ref } from "vue";
import { useSidebar } from "./utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

const { isMobile, openMobile, setOpenMobile } = useSidebar();

const touchStartX = ref(0);
const touchStartY = ref(0);
const trackingSwipe = ref(false);

const EDGE_ZONE_PX = 32;
const SWIPE_THRESHOLD_PX = 60;
const VERTICAL_TOLERANCE_PX = 40;

function onTouchStart(event: TouchEvent) {
  if (!isMobile.value || openMobile.value) return;
  const touch = event.touches[0];
  if (!touch) return;

  touchStartX.value = touch.clientX;
  touchStartY.value = touch.clientY;
  trackingSwipe.value = touchStartX.value <= EDGE_ZONE_PX;
}

function onTouchMove(event: TouchEvent) {
  if (!trackingSwipe.value || !isMobile.value || openMobile.value) return;

  const touch = event.touches[0];
  if (!touch) return;

  const deltaX = touch.clientX - touchStartX.value;
  const deltaY = touch.clientY - touchStartY.value;

  if (Math.abs(deltaY) > VERTICAL_TOLERANCE_PX) {
    trackingSwipe.value = false;
    return;
  }

  if (deltaX > SWIPE_THRESHOLD_PX) {
    setOpenMobile(true);
    trackingSwipe.value = false;
  }
}

function onTouchEnd() {
  trackingSwipe.value = false;
}
</script>

<template>
  <main
    data-slot="sidebar-inset"
    :class="
      cn(
        'bg-background relative flex min-w-0 flex-1 flex-col overflow-x-hidden',
        'md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2',
        props.class,
      )
    "
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend.passive="onTouchEnd"
  >
    <slot></slot>
  </main>
</template>
