<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { Loader2Icon } from "lucide-vue-next";
import { cn } from "@/lib/utils";

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
