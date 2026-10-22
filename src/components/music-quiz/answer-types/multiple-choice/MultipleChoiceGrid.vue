<template>
  <div class="grid gap-3 sm:grid-cols-2">
    <Button
      v-for="(suggestion, index) in suggestions"
      :key="suggestion.suggestion_id"
      class="h-auto min-h-16 justify-start gap-3 whitespace-normal py-3 text-left text-base font-semibold"
      :disabled="disabled"
      :variant="
        selectedSuggestionId === suggestion.suggestion_id
          ? 'default'
          : 'outline'
      "
      @click="emit('select', suggestion.suggestion_id)"
    >
      <span
        class="bg-background/20 flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-bold"
        aria-hidden="true"
      >
        {{ optionLetter(index) }}
      </span>
      <span class="min-w-0 flex-1 leading-snug break-words">
        {{ suggestion.label }}
      </span>
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import type { MusicQuizSuggestion } from "@/composables/music-quiz/useMusicQuiz";

const OPTION_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

defineProps<{
  suggestions: MusicQuizSuggestion[];
  disabled: boolean;
  selectedSuggestionId: string | null;
}>();
const emit = defineEmits<{ select: [suggestionId: string] }>();

function optionLetter(index: number): string {
  return OPTION_LETTERS[index] ?? String(index + 1);
}
</script>
