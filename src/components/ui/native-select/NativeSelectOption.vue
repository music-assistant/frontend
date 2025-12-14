<!-- @fallthroughAttributes true -->
<!-- @strictTemplates true -->

<script setup lang="ts">
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <option
    data-slot="native-select-option"
    :class="cn('bg-popover text-popover-foreground', props.class)"
  >
    <slot></slot>
  </option>
</template>
