<template>
  <svg
    class="autoplay-icon"
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
    <path
      :class="{ 'autoplay-base--dimmed': active }"
      d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8"
    />
    <path
      v-if="active"
      class="autoplay-spark"
      pathLength="100"
      d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8"
    />
  </svg>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number | string;
    active?: boolean;
  }>(),
  {
    size: 24,
    active: false,
  },
);
</script>

<style scoped>
.autoplay-icon {
  display: inline-block;
  vertical-align: middle;
  overflow: visible;
}

.autoplay-base--dimmed {
  opacity: 0.4;
}

.autoplay-spark {
  stroke: color-mix(in srgb, currentColor 20%, #ffffff);
  stroke-linecap: round;
  stroke-dasharray: 10 90;
  stroke-dashoffset: 0;
  filter: drop-shadow(0 0 3px currentColor);
  animation: autoplay-spark-travel 2.4s linear infinite;
}

@keyframes autoplay-spark-travel {
  to {
    stroke-dashoffset: -100;
  }
}

@media (prefers-reduced-motion: reduce) {
  .autoplay-spark {
    animation: none;
    opacity: 0.85;
  }
}
</style>
