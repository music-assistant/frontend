<template>
  <!--
    Repeat icon.
    Inlined versions of the tabler "repeat-off", "repeat" and "repeat-once"
    icons, one per repeat mode.
  -->
  <svg
    class="inline-block align-middle"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="mode === RepeatMode.OFF">
      <path
        d="M4 12v-3c0 -1.336 .873 -2.468 2.08 -2.856m3.92 -.144h10m-3 -3l3 3l-3 3"
      />
      <path
        d="M20 12v3a3 3 0 0 1 -.133 .886m-1.99 1.984a3 3 0 0 1 -.877 .13h-13m3 3l-3 -3l3 -3"
      />
      <path d="M3 3l18 18" />
    </template>
    <template v-else>
      <path d="M4 12v-3a3 3 0 0 1 3 -3h13m-3 -3l3 3l-3 3" />
      <path d="M20 12v3a3 3 0 0 1 -3 3h-13m3 3l-3 -3l3 -3" />
      <!-- the "1" of repeat-one -->
      <path v-if="mode !== RepeatMode.ALL" d="M11 11l1 -1v4" />
    </template>
  </svg>
</template>

<script setup lang="ts">
import { RepeatMode } from "@/plugins/api/interfaces";

withDefaults(
  defineProps<{
    mode: RepeatMode;
    size?: number | string;
  }>(),
  {
    size: 24,
  },
);
</script>
