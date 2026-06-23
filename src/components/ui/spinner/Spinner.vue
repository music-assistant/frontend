<script setup lang="ts">
import { cn } from "@/lib/utils";
import { Loader2Icon } from "@lucide/vue";
import type { HTMLAttributes } from "vue";

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"];
    size?: number;
  }>(),
  {
    class: undefined,
    size: undefined,
  },
);
</script>

<template>
  <Loader2Icon
    role="status"
    aria-label="Loading"
    :size="props.size"
    :class="cn('size-4 animate-spin', props.class)"
  />
</template>
