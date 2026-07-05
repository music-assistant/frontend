<template>
  <!--
    Shuffle icon.
    Inlined version of the lucide "shuffle" icon. When smart shuffle is active
    the short upper-left stub is replaced by an "AI sparkle" (à la Spotify's
    smart shuffle) that twinkles with a soft glow, setting the smart mode apart
    from plain shuffle.
  -->
  <svg
    class="shuffle-icon"
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
    <path d="m18 14 4 4-4 4" />
    <path d="m18 2 4 4-4 4" />
    <path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22" />
    <!-- upper-left stub: shown for plain shuffle, replaced by the sparkle when smart -->
    <path v-if="!smart" d="M2 6h1.972a4 4 0 0 1 3.6 2.2" />
    <path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" />
    <path
      v-if="smart"
      class="shuffle-sparkle"
      stroke="none"
      fill="currentColor"
      d="M5 2.6Q6.1 5.9 9.4 7Q6.1 8.1 5 11.4Q3.9 8.1 0.6 7Q3.9 5.9 5 2.6Z"
    />
  </svg>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number | string;
    smart?: boolean;
  }>(),
  {
    size: 24,
    smart: false,
  },
);
</script>

<style scoped>
.shuffle-icon {
  display: inline-block;
  vertical-align: middle;
  /* let the sparkle glow extend slightly beyond the icon box */
  overflow: visible;
}

/*
  The "AI sparkle" that marks smart shuffle: a soft glow plus a gentle scale +
  opacity pulse around its own centre, so the smart state reads at a glance.
*/
.shuffle-sparkle {
  transform-box: fill-box;
  transform-origin: center;
  filter: drop-shadow(0 0 2px currentColor);
  animation: shuffle-sparkle-twinkle 2.4s ease-in-out infinite;
}

@keyframes shuffle-sparkle-twinkle {
  0%,
  100% {
    opacity: 0.6;
    transform: scale(0.78);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .shuffle-sparkle {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>
