<template>
  <div
    class="absolute inset-0 z-[3] flex items-center justify-center bg-black/40 text-white"
    aria-hidden="true"
  >
    <Spinner :class="spinnerClass" />
  </div>
</template>

<script setup lang="ts">
// A dimmed spinner over an item's artwork while the item is being opened; the
// item itself carries aria-busy for assistive technology.
import { Spinner } from "@/components/ui/spinner";
import type { HTMLAttributes } from "vue";

interface Props {
  // the spinner's size, e.g. "size-5"
  spinnerClass: HTMLAttributes["class"];
}
defineProps<Props>();
</script>
