<template>
  <div class="flex min-h-0 flex-col gap-3">
    <TriviaQuestion class="flex-1" :round="currentRound" present />
    <div
      v-if="countdownText"
      class="bg-muted/40 text-muted-foreground flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold tabular-nums"
      role="timer"
      :aria-label="countdownText"
      data-testid="trivia-auto-advance"
    >
      <Clock3 class="size-4" aria-hidden="true" />
      {{ countdownText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MusicQuizPresentGameAdapterProps } from "@/components/music-quiz/adapter_contracts";
import TriviaQuestion from "@/components/music-quiz/game-types/trivia/TriviaQuestion.vue";
import type {
  MusicQuizTriviaHostState,
  MusicQuizTriviaRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { useMusicQuizRevealCountdown } from "@/composables/music-quiz/useMusicQuizRevealCountdown";
import { $t } from "@/plugins/i18n";
import { Clock3 } from "@lucide/vue";
import { computed } from "vue";

const props =
  defineProps<
    MusicQuizPresentGameAdapterProps<
      MusicQuizTriviaHostState,
      MusicQuizTriviaRound
    >
  >();

const isFinalRound = computed(
  () => props.currentRound.round_index + 1 >= props.state.round_count,
);
const { hasElapsed, isScheduled, remainingLabel } = useMusicQuizRevealCountdown(
  {
    active: () => props.state.phase === "reveal",
    autoAdvanceAt: () => props.currentRound.auto_advance_at,
  },
);
const countdownText = computed(() => {
  if (!isScheduled.value) return "";
  if (hasElapsed.value) {
    return $t(
      isFinalRound.value
        ? "providers.music_quiz.waiting_for_final_results"
        : "providers.music_quiz.waiting_for_next",
    );
  }
  return $t(
    isFinalRound.value
      ? "providers.music_quiz.final_results_in"
      : "providers.music_quiz.next_round_in",
    [remainingLabel.value],
  );
});
</script>
