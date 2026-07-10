<script setup lang="ts">
defineOptions({
  name: "MusicQuizIcon",
});

const props = withDefaults(
  defineProps<{
    strokeWidth?: number;
  }>(),
  {
    strokeWidth: 2,
  },
);
</script>

<!-- sidebar Music Quiz icon, drawn in a lucide-like microphone stroke style -->
<template>
  <svg
    class="music-quiz-icon"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 12a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3Z"
      stroke="currentColor"
      :stroke-width="props.strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M19 10v1a7 7 0 0 1-14 0v-1"
      stroke="currentColor"
      :stroke-width="props.strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M12 18v3"
      stroke="currentColor"
      :stroke-width="props.strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M8 21h8"
      stroke="currentColor"
      :stroke-width="props.strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
