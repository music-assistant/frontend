<template>
  <div class="relative flex min-h-0 flex-1 flex-col">
    <div
      ref="scroller"
      v-bind="$attrs"
      :class="cn('min-h-0 flex-1 overflow-y-auto', props.class)"
    >
      <slot></slot>
    </div>
    <div
      class="from-background pointer-events-none absolute inset-x-0 top-0 h-6 bg-linear-to-b to-transparent transition-opacity"
      :class="arrivedState.top ? 'opacity-0' : 'opacity-100'"
      aria-hidden="true"
    ></div>
    <div
      class="from-background pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-linear-to-t to-transparent transition-opacity"
      :class="arrivedState.bottom ? 'opacity-0' : 'opacity-100'"
      aria-hidden="true"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { cn } from "@/lib/utils";
import {
  useMutationObserver,
  useResizeObserver,
  useScroll,
} from "@vueuse/core";
import { ref, type HTMLAttributes } from "vue";

// A scroll container that fades out at an edge with more content past it.
// Measured again as the container or what is in it changes size, since the
// lists in the wizard fill up while it is open.
defineOptions({ inheritAttrs: false });

const props = defineProps<{ class?: HTMLAttributes["class"] }>();

const scroller = ref<HTMLElement | null>(null);
const { arrivedState, measure } = useScroll(scroller);
useResizeObserver(scroller, measure);
useMutationObserver(scroller, measure, {
  childList: true,
  subtree: true,
  characterData: true,
});
</script>
