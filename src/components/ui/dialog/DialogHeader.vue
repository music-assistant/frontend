<script setup lang="ts">
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

// max-sm:text-center rather than text-center: Vuetify's global .text-center
// utility would otherwise override sm:text-left.
</script>

<template>
  <div
    data-slot="dialog-header"
    :class="
      cn('flex flex-col gap-2 max-sm:text-center sm:text-left', props.class)
    "
  >
    <slot></slot>
  </div>
</template>
