<!-- @fallthroughAttributes true -->
<!-- @strictTemplates true -->

<script setup lang="ts">
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <optgroup
    data-slot="native-select-optgroup"
    :class="cn('bg-popover text-popover-foreground', props.class)"
  >
    <slot></slot>
  </optgroup>
</template>
