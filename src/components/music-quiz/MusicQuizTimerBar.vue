<template>
  <!-- No visible number: the bar is the countdown; the label keeps it for screen readers. -->
  <div
    class="bg-muted h-[46px] w-full overflow-hidden rounded-[24px]"
    role="timer"
    :aria-label="label"
  >
    <!-- Slides out rather than narrowing, so a nearly empty bar stays a thin
         sliver instead of squashing its rounded ends into a blob. -->
    <div
      class="h-full w-full -translate-x-(--timer-gap) rounded-[24px] transition-transform duration-200 ease-linear motion-reduce:transition-none rtl:translate-x-(--timer-gap)"
      :class="isUrgent ? 'bg-destructive' : 'bg-primary'"
      :style="{ '--timer-gap': `${100 - percent}%` }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const URGENT_THRESHOLD = 0.25;

const props = defineProps<{
  label: string;
  fraction: number | null;
}>();

const percent = computed(
  () => Math.min(1, Math.max(0, props.fraction ?? 0)) * 100,
);
const isUrgent = computed(
  () => props.fraction !== null && props.fraction <= URGENT_THRESHOLD,
);
</script>
