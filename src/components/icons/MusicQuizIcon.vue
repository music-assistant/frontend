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

<!-- a microphone with a question mark: the sidebar twin of the provider
     manifest's mdi-microphone-question, drawn in the lucide stroke style -->
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
      d="M10 3a2.5 2.5 0 0 0-2.5 2.5v6a2.5 2.5 0 0 0 5 0v-6A2.5 2.5 0 0 0 10 3Z"
      stroke="currentColor"
      :stroke-width="props.strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M16 10.5v1a6 6 0 0 1-12 0v-1"
      stroke="currentColor"
      :stroke-width="props.strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M10 17.5V21"
      stroke="currentColor"
      :stroke-width="props.strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M17.5 5.5a2.25 2.25 0 1 1 3.2 2.05c-.6.28-.95.65-.95 1.25v.7"
      stroke="currentColor"
      :stroke-width="props.strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M19.75 12.75v.01"
      stroke="currentColor"
      :stroke-width="props.strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
