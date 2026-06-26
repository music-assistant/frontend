<template>
  <!--
    Crossfade ("blend") icon.
    Inlined version of the lucide "blend" icon (two overlapping circles) so that,
    when smart fades are active, we can animate a small "twinkle" that travels
    along the stroke of each circle.
  -->
  <svg
    class="crossfade-icon"
    :class="{ 'is-smart': smart }"
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
    smart?: boolean;
  }>(),
  {
    size: 24,
    smart: false,
  },
);
</script>

<style scoped>
.crossfade-icon {
  display: inline-block;
  vertical-align: middle;
  /* allow the spark glow to extend slightly beyond the icon box */
  overflow: visible;
}

/* whole-icon "breathing" glow so the smart state is noticeable at a glance */
.crossfade-icon.is-smart {
  animation: crossfade-smart-pulse 2.4s ease-in-out infinite;
}

/*
  In smart mode fade the two base rings a touch so the bright travelling spark
  clearly stands out. This matters most when the icon sits on the solid
  primary-coloured (blue) button: there the stroke is white, and an equally
  white spark would otherwise be invisible against the (white) rings.
*/
.crossfade-icon.is-smart > circle:not(.crossfade-spark) {
  opacity: 0.4;
}

/*
  A short bright dash that travels around each circle.
  The circumference of a circle with r=7 is 2 * PI * 7 ≈ 43.98, so we use a
  dash of length 4 with a gap that fills the rest, then animate the offset by
  the full circumference for a seamless loop.
*/
.crossfade-spark {
  stroke: color-mix(in srgb, currentColor 20%, #ffffff);
  stroke-linecap: round;
  stroke-dasharray: 4 39.98;
  stroke-dashoffset: 0;
  filter: drop-shadow(0 0 3px currentColor);
  animation: crossfade-spark-travel 2.4s linear infinite;
}

.crossfade-spark--delayed {
  /* offset the second circle's spark so both twinkles are out of phase */
  animation-delay: -1.2s;
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
  .crossfade-icon.is-smart {
    animation: none;
  }
  .crossfade-spark {
    animation: none;
    opacity: 0.85;
  }
}
</style>
