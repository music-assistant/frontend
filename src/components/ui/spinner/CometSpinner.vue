<script setup lang="ts">
import { $t } from "@/plugins/i18n";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"];
    /** Ring thickness in pixels, kept the same at every size. */
    strokeWidth?: number;
  }>(),
  {
    class: undefined,
    strokeWidth: 2,
  },
);
</script>

<template>
  <span
    role="status"
    :aria-label="$t('loading_short')"
    :class="cn('comet-spinner relative block size-4 shrink-0', props.class)"
    :style="{ '--comet-stroke': `${props.strokeWidth}px` }"
  >
    <span class="comet-spinner-sweep absolute inset-0">
      <span class="comet-spinner-tail absolute inset-0 rounded-full"></span>
      <span
        class="absolute top-0 left-1/2 size-(--comet-stroke) -translate-x-1/2 rounded-full bg-current"
      ></span>
    </span>
  </span>
</template>

<style scoped>
/* lets the tail length animate */
@property --comet-tail {
  syntax: "<angle>";
  inherits: false;
  initial-value: 220deg;
}

/* 0 hides the tail, so a transition can draw it in or out */
@property --comet-reveal {
  syntax: "<number>";
  inherits: true;
  initial-value: 1;
}

/* a steady turn */
.comet-spinner {
  animation: comet-spinner-spin 1.4s linear infinite;
}

/* the head swings ahead and back while the tail stretches with it. The
   swing never outpaces the turn, so nothing moves backwards, and its
   period moves the slow point about 100deg each time */
.comet-spinner-sweep {
  animation: comet-spinner-sweep 1.79s infinite;
}

.comet-spinner-tail {
  background: conic-gradient(
    transparent calc(1turn - var(--comet-tail) * var(--comet-reveal)),
    currentColor
  );
  mask: radial-gradient(
    farthest-side,
    transparent calc(100% - var(--comet-stroke) - 0.5px),
    #000 calc(100% - var(--comet-stroke))
  );
  animation: comet-spinner-tail 1.79s infinite;
}

@keyframes comet-spinner-spin {
  to {
    transform: rotate(360deg);
  }
}

/* sine-like easing */
@keyframes comet-spinner-sweep {
  0%,
  50% {
    transform: rotate(0deg);
    animation-timing-function: cubic-bezier(0.61, 1, 0.88, 1);
  }
  25% {
    transform: rotate(40deg);
    animation-timing-function: cubic-bezier(0.12, 0, 0.39, 0);
  }
  75% {
    transform: rotate(-40deg);
    animation-timing-function: cubic-bezier(0.12, 0, 0.39, 0);
  }
  100% {
    transform: rotate(0deg);
  }
}

/* twice the head swing, so the tail end swings the other way */
@keyframes comet-spinner-tail {
  0%,
  50% {
    --comet-tail: 220deg;
    animation-timing-function: cubic-bezier(0.61, 1, 0.88, 1);
  }
  25% {
    --comet-tail: 300deg;
    animation-timing-function: cubic-bezier(0.12, 0, 0.39, 0);
  }
  75% {
    --comet-tail: 140deg;
    animation-timing-function: cubic-bezier(0.12, 0, 0.39, 0);
  }
  100% {
    --comet-tail: 220deg;
  }
}

@media (prefers-reduced-motion: reduce) {
  .comet-spinner-sweep,
  .comet-spinner-tail {
    animation: none;
  }
}
</style>
