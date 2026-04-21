<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect width="16" height="20" x="4" y="2" rx="2" />
    <circle cx="12" cy="14" r="4" />
    <line x1="12" y1="6" x2="12.01" y2="6" />
    <!-- cone ripples -->
    <template v-if="playing">
      <circle cx="12" cy="14" r="4" class="ripple ripple--1" />
      <circle cx="12" cy="14" r="4" class="ripple ripple--2" />
      <!-- tweeter ripple -->
      <circle cx="12" cy="6" r="1" class="ripple-sm ripple--1" />
      <circle cx="12" cy="6" r="1" class="ripple-sm ripple--2" />
    </template>
  </svg>
</template>

<script setup lang="ts">
interface Props {
  size?: number;
  playing?: boolean;
}
withDefaults(defineProps<Props>(), {
  size: 24,
  playing: false,
});
</script>

<style scoped>
.ripple {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  animation: ripple-wave 1s ease-out infinite;
}

.ripple-sm {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  animation: ripple-wave-sm 1s ease-out infinite;
}

.ripple--2 {
  animation-delay: 0.5s;
}

@keyframes ripple-wave {
  0% {
    r: 4;
    opacity: 0.7;
  }
  100% {
    r: 8;
    opacity: 0;
  }
}

@keyframes ripple-wave-sm {
  0% {
    r: 1;
    opacity: 0.7;
  }
  100% {
    r: 3.5;
    opacity: 0;
  }
}
</style>
