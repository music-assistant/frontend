<template>
  <svg
    class="crossfade-icon"
    :class="{ 'is-smart': smart, 'is-active': active && !smart }"
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
    <circle class="crossfade-ring crossfade-ring--a" cx="9" cy="9" r="7" />
    <circle class="crossfade-ring crossfade-ring--b" cx="15" cy="15" r="7" />
    <template v-if="smart">
      <circle class="crossfade-spark" cx="9" cy="9" r="7" />
      <circle
        class="crossfade-spark crossfade-spark--delayed"
        cx="15"
        cy="15"
        r="7"
      />
    </template>
  </svg>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number | string;
    active?: boolean;
    smart?: boolean;
  }>(),
  {
    size: 24,
    active: false,
    smart: false,
  },
);
</script>

<style scoped>
.crossfade-icon {
  display: inline-block;
  vertical-align: middle;
  overflow: visible;
}

.crossfade-icon.is-active .crossfade-ring {
  animation: crossfade-ring-fade 2.4s ease-in-out infinite;
}

.crossfade-icon.is-active .crossfade-ring--b {
  animation-delay: -1.2s;
}

.crossfade-icon.is-smart {
  animation: crossfade-smart-pulse 2.4s ease-in-out infinite;
}

.crossfade-icon.is-smart .crossfade-ring {
  opacity: 0.4;
}

.crossfade-spark {
  stroke: color-mix(in srgb, currentColor 20%, #ffffff);
  stroke-linecap: round;
  stroke-dasharray: 4 39.98;
  stroke-dashoffset: 0;
  filter: drop-shadow(0 0 3px currentColor);
  animation: crossfade-spark-travel 2.4s linear infinite;
}

.crossfade-spark--delayed {
  animation-delay: -1.2s;
}

@keyframes crossfade-ring-fade {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

@keyframes crossfade-spark-travel {
  0% {
    stroke-dashoffset: 0;
    opacity: 0.15;
  }
  15% {
    opacity: 1;
  }
  85% {
    opacity: 1;
  }
  100% {
    stroke-dashoffset: -43.98;
    opacity: 0.15;
  }
}

@keyframes crossfade-smart-pulse {
  0%,
  100% {
    filter: drop-shadow(0 0 0 transparent);
  }
  50% {
    filter: drop-shadow(0 0 3px currentColor);
  }
}

@media (prefers-reduced-motion: reduce) {
  .crossfade-icon.is-smart,
  .crossfade-icon.is-active .crossfade-ring {
    animation: none;
  }
  .crossfade-spark {
    animation: none;
    opacity: 0.85;
  }
}
</style>
