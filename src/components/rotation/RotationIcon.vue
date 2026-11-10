<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    :class="cn('h-6 w-6 shrink-0', props.class)"
  >
    <circle cx="12" cy="12" r="1.5" />
    <path d="M12 7.5a4.5 4.5 0 1 1-4.5 4.5" />
    <path d="M21 12a9 9 0 1 1-9-9" />
    <path d="M12 3h4.5" />
    <path d="M14.5 1 16.5 3l-2 2" />
  </svg>
</template>

<script setup lang="ts">
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>
