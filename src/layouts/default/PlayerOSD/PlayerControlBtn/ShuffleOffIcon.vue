<template>
  <!--
    Shuffle off icon.
    Inlined version of the tabler "arrows-right" icon: two straight arrows, the
    unshuffled counterpart of ShuffleIcon.
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
    <path d="M21 17l-18 0" />
    <path d="M18 4l3 3l-3 3" />
    <path d="M18 20l3 -3l-3 -3" />
    <path d="M21 7l-18 0" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number | string;
  }>(),
  {
    size: 24,
  },
);
</script>
