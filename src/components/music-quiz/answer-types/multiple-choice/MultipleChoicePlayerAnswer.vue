<template>
  <template v-if="state.phase === 'answering'">
    <p class="text-center text-lg font-bold">
      {{ $t("providers.music_quiz.choose_answer") }}
    </p>
    <MultipleChoiceGrid
      :suggestions="currentRound.suggestions"
      :disabled="busy || !!state.you.answer"
      :selected-suggestion-id="state.you.answer?.suggestion_id ?? null"
      @select="submit"
    />
    <p
      v-if="state.you.answer"
      class="text-muted-foreground text-center"
      role="status"
    >
      {{ $t("providers.music_quiz.answered") }}
    </p>
    <MultipleChoiceProgress
      :statuses="roundPlayerStatuses"
      :answered-count="answeredCount"
    />
  </template>

  <template v-else-if="state.phase === 'reveal'">
    <p
      v-if="!state.you.answer"
      class="text-destructive text-center font-semibold"
      role="status"
    >
      {{ $t("providers.music_quiz.no_answer_submitted") }}
    </p>
  </template>
</template>

<script setup lang="ts">
import type {
  MusicQuizPlayerAnswerAdapterEmits,
  MusicQuizPlayerAnswerAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import MultipleChoiceGrid from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceGrid.vue";
import MultipleChoiceProgress from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceProgress.vue";
import type {
  MusicQuizMultipleChoicePersonalizedState,
  MusicQuizMultipleChoiceRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { getMusicQuizRoundPlayers } from "@/helpers/music_quiz";
import { $t } from "@/plugins/i18n";
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

function submit(suggestionId: string) {
  emit("submit", {
    answer_type: "multiple_choice",
    suggestion_id: suggestionId,
  });
}
</script>
