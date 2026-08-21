<script setup lang="ts">
import { useEdgeSwipeNavigation } from "@/composables/useEdgeSwipeNavigation";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

const {
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  surfaceRef,
  swipeStyle,
} = useEdgeSwipeNavigation();
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
    @touchcancel.passive="onTouchCancel"
  >
    <div
      ref="surfaceRef"
      class="bg-background flex min-h-0 flex-1 flex-col"
      :style="swipeStyle"
    >
      <slot></slot>
    </div>
  </main>
</template>
