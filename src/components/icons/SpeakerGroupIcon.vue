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
    <!-- mask to hide the back speaker where it overlaps the front -->
    <defs>
      <mask id="back-speaker-mask">
        <rect width="24" height="24" fill="white" />
        <rect width="15" height="19" x="1" y="5" rx="2" fill="black" />
      </mask>
    </defs>
    <!-- back speaker (offset), masked to hide behind front -->
    <rect
      width="13"
      height="17"
      x="9"
      y="1"
      rx="2"
      opacity="0.45"
      mask="url(#back-speaker-mask)"
    />
    <!-- front speaker -->
    <rect width="13" height="17" x="2" y="6" rx="2" />
    <circle cx="8.5" cy="15" r="2.8" />
    <line x1="8.5" y1="9" x2="8.51" y2="9" />
    <!-- cone ripples -->
    <template v-if="playing">
      <circle cx="8.5" cy="15" r="2.8" class="ripple ripple--1" />
      <circle cx="8.5" cy="15" r="2.8" class="ripple ripple--2" />
      <!-- tweeter ripple -->
      <circle cx="8.5" cy="9" r="1" class="ripple-sm ripple--1" />
      <circle cx="8.5" cy="9" r="1" class="ripple-sm ripple--2" />
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
    r: 2.8;
    opacity: 0.7;
  }
  100% {
    r: 6;
    opacity: 0;
  }
}

@keyframes ripple-wave-sm {
  0% {
    r: 1;
    opacity: 0.7;
  }
  100% {
    r: 3;
    opacity: 0;
  }
}
</style>
