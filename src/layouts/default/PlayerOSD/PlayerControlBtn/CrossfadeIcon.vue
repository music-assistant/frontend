<template>
  <svg
    class="crossfade-icon"
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
    <circle cx="9" cy="9" r="7" />
    <circle cx="15" cy="15" r="7" />
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

<style scoped>
.crossfade-icon {
  display: inline-block;
  vertical-align: middle;
  overflow: visible;
}
</style>
