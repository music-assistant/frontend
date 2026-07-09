<template>
  <section class="quiz-answers">
    <Button
      v-for="suggestion in suggestions"
      :key="suggestion.suggestion_id"
      class="quiz-answers__button"
      :disabled="disabled"
      :variant="
        selectedSuggestionId === suggestion.suggestion_id
          ? 'default'
          : 'outline'
      "
      @click="emit('select', suggestion.suggestion_id)"
    >
      <span>{{ suggestion.label }}</span>
    </Button>
  </section>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import type { MusicQuizSuggestion } from "@/composables/useMusicQuiz";

defineProps<{
  suggestions: MusicQuizSuggestion[];
  disabled: boolean;
  selectedSuggestionId: string | null;
}>();
const emit = defineEmits<{ select: [suggestionId: string] }>();
</script>

<style scoped>
.quiz-answers {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--card));
  padding: 0.875rem;
}

.quiz-answers__button {
  min-height: 3.5rem;
  height: auto;
  align-items: center;
  justify-content: flex-start;
  padding-block: 0.55rem;
  text-align: left;
  line-height: 1.35;
  white-space: normal;
}

.quiz-answers__button span {
  display: block;
  min-width: 0;
  overflow: visible;
  overflow-wrap: anywhere;
  white-space: normal;
}
</style>
