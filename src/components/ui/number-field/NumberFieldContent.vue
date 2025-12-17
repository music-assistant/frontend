<script setup lang="ts">
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <div
    :class="
      cn(
        'relative [&>[data-slot=input]]:has-[[data-slot=increment]]:has-[[data-slot=decrement]]:px-10',
        props.class,
      )
    "
  >
    <slot></slot>
  </div>
</template>
