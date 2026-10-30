<template>
  <div class="grid gap-3 sm:grid-cols-2">
    <Button
      v-for="(suggestion, index) in suggestions"
      :key="suggestion.suggestion_id"
      :class="
        cn(
          'h-auto min-h-[72px] justify-start gap-3 rounded-xl py-3 text-start text-lg font-semibold whitespace-normal active:scale-[0.98]',
          isSelected(suggestion.suggestion_id) && 'disabled:opacity-100',
          hasAnswered &&
            !isSelected(suggestion.suggestion_id) &&
            'disabled:opacity-40',
        )
      "
      :disabled="disabled"
      :aria-pressed="isSelected(suggestion.suggestion_id)"
      :variant="isSelected(suggestion.suggestion_id) ? 'default' : 'outline'"
      @click="emit('select', suggestion.suggestion_id)"
    >
      <span
        class="flex size-10 shrink-0 items-center justify-center rounded-lg text-base font-bold"
        :class="
          isSelected(suggestion.suggestion_id)
            ? 'bg-primary-foreground/20 text-primary-foreground'
            : 'bg-primary/15 text-primary'
        "
        aria-hidden="true"
      >
        {{ optionLetter(index) }}
      </span>
      <span class="min-w-0 flex-1 leading-snug break-words">
        {{ suggestion.label }}
      </span>
      <CircleCheck
        v-if="isSelected(suggestion.suggestion_id)"
        class="size-6 shrink-0"
        aria-hidden="true"
      />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import type { MusicQuizSuggestion } from "@/composables/music-quiz/useMusicQuiz";
import { cn } from "@/lib/utils";
import { CircleCheck } from "@lucide/vue";
import { computed } from "vue";

const OPTION_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const props = defineProps<{
  suggestions: MusicQuizSuggestion[];
  disabled: boolean;
  selectedSuggestionId: string | null;
}>();
const emit = defineEmits<{ select: [suggestionId: string] }>();

const hasAnswered = computed(() => props.selectedSuggestionId !== null);

function isSelected(suggestionId: string): boolean {
  return props.selectedSuggestionId === suggestionId;
}

function optionLetter(index: number): string {
  return OPTION_LETTERS[index] ?? String(index + 1);
}
</script>
