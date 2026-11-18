<template>
  <!--
    Skip icon.
    A circular arrow in the lucide stroke style, pointing back or forward,
    with the number of seconds inside.
  -->
  <svg
    class="skip-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="direction === 'back'">
      <path d="M3.5 13.5a8.5 8.5 0 1 0 8.5-8.5H3.5" />
      <path d="M7 1.5 3.5 5 7 8.5" />
    </template>
    <template v-else>
      <path d="M20.5 13.5a8.5 8.5 0 1 1-8.5-8.5h8.5" />
      <path d="m17 1.5 3.5 3.5-3.5 3.5" />
    </template>
    <!-- a leading 1 is narrow, so shift the number left to look centred -->
    <text
      :x="String(seconds).startsWith('1') ? 11.4 : 12"
      y="14"
      fill="currentColor"
      stroke="none"
      font-family="sans-serif"
      font-size="9"
      font-weight="600"
      text-anchor="middle"
      dominant-baseline="central"
    >
      {{ seconds }}
    </text>
  </svg>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    direction: "back" | "forward";
    seconds: number;
    size?: number | string;
    strokeWidth?: number | string;
  }>(),
  {
    size: 24,
    strokeWidth: 2,
  },
);
</script>

<style scoped>
.skip-icon {
  display: inline-block;
  vertical-align: middle;
}
</style>
