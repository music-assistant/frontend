<template>
  <template v-if="state.phase === 'answering'">
    <p class="text-center text-lg font-bold">
      {{ $t("providers.music_quiz.choose_answer") }}
    </p>
    <MultipleChoicePlayerGrid
      :suggestions="currentRound.suggestions"
      :disabled="busy || !!state.you.answer"
      :selected-suggestion-id="state.you.answer?.suggestion_id ?? null"
      @select="submit"
    />
    <p
      v-if="state.you.answer"
      class="text-primary flex items-center justify-center gap-2 text-center font-semibold"
      role="status"
    >
      <Lock class="size-4" aria-hidden="true" />
      {{ lockedInText }}
    </p>
    <MultipleChoiceProgress
      :statuses="roundPlayerStatuses"
      :answered-count="answeredCount"
    />
  </template>

  <!-- At the reveal the result panel above says how the answer went. -->
</template>

<script setup lang="ts">
import type {
  MusicQuizPlayerAnswerAdapterEmits,
  MusicQuizPlayerAnswerAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import MultipleChoicePlayerGrid from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoicePlayerGrid.vue";
import MultipleChoiceProgress from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceProgress.vue";
import type {
  MusicQuizMultipleChoicePersonalizedState,
  MusicQuizMultipleChoiceRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { getMusicQuizRoundPlayers } from "@/helpers/music_quiz";
import { $t } from "@/plugins/i18n";
import { Lock } from "@lucide/vue";
import { computed } from "vue";

const props =
  defineProps<
    MusicQuizPlayerAnswerAdapterProps<
      MusicQuizMultipleChoicePersonalizedState,
      MusicQuizMultipleChoiceRound
    >
  >();
const emit =
  defineEmits<MusicQuizPlayerAnswerAdapterEmits<"multiple_choice">>();

const roundPlayerStatuses = computed(() =>
  getMusicQuizRoundPlayers(props.state.players, props.currentRound.round_index),
);
const answeredCount = computed(
  () => roundPlayerStatuses.value.filter((player) => player.answered).length,
);

const lockedInText = computed(() => {
  const waiting = roundPlayerStatuses.value.length - answeredCount.value;
  return waiting > 0
    ? $t("providers.music_quiz.locked_in_waiting", [waiting])
    : $t("providers.music_quiz.locked_in_everyone");
});

function submit(suggestionId: string) {
  emit("submit", {
    answer_type: "multiple_choice",
    suggestion_id: suggestionId,
  });
}
</script>
