<template>
  <template v-if="state.phase === 'answering'">
    <template v-if="canAnswerRound">
      <div class="flex flex-col items-center gap-2">
        <MusicQuizCountdown
          :size="132"
          :fraction="remainingFraction"
          :label="remainingLabel || '…'"
        />
        <p class="text-lg font-bold">
          {{ $t("providers.music_quiz.choose_answer") }}
        </p>
      </div>
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
    </template>
    <p v-else class="text-muted-foreground text-center" role="status">
      {{ $t("providers.music_quiz.waiting_for_next") }}
    </p>
    <MultipleChoiceProgress
      :statuses="roundPlayerStatuses"
      :answered-count="answeredCount"
    />
  </template>

  <template v-else-if="state.phase === 'reveal'">
    <div
      v-if="state.you.answer?.correct"
      class="flex items-center justify-center gap-2 rounded-md bg-green-500/15 py-2 font-semibold text-green-600 dark:text-green-400"
      role="status"
    >
      <CircleCheck class="size-5" />
      {{ $t("providers.music_quiz.correct") }}
      <span>+{{ state.you.answer.points ?? 0 }}</span>
    </div>
    <div
      v-else-if="state.you.answer"
      class="text-destructive flex items-center justify-center gap-2 rounded-md bg-red-500/10 py-2 font-semibold"
      role="status"
    >
      <CircleX class="size-5" />
      {{ $t("providers.music_quiz.incorrect") }}
    </div>
    <p
      v-else-if="!canAnswerRound"
      class="text-muted-foreground text-center"
      role="status"
    >
      {{ $t("providers.music_quiz.waiting_for_next") }}
    </p>
    <div
      v-else
      class="text-destructive flex items-center justify-center gap-2 rounded-md bg-red-500/10 py-2 font-semibold"
      role="status"
    >
      <CircleX class="size-5" />
      {{ $t("providers.music_quiz.no_answer_submitted") }}
    </div>
  </template>
</template>

<script setup lang="ts">
import type {
  MusicQuizPlayerAnswerAdapterEmits,
  MusicQuizPlayerAnswerAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import MultipleChoiceGrid from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceGrid.vue";
import MultipleChoiceProgress from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceProgress.vue";
import MusicQuizCountdown from "@/components/music-quiz/MusicQuizCountdown.vue";
import type {
  MusicQuizMultipleChoicePersonalizedState,
  MusicQuizMultipleChoiceRound,
} from "@/composables/useMusicQuiz";
import { useMusicQuizAnswerDeadline } from "@/composables/useMusicQuizAnswerDeadline";
import { getMusicQuizRoundPlayers } from "@/helpers/music_quiz";
import { $t } from "@/plugins/i18n";
import { CircleCheck, CircleX } from "@lucide/vue";
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
const canAnswerRound = computed(
  () => props.state.you.active_from_round <= props.currentRound.round_index,
);
const answeredCount = computed(
  () => roundPlayerStatuses.value.filter((player) => player.answered).length,
);
const { remainingLabel, remainingFraction } = useMusicQuizAnswerDeadline({
  active: () => props.state.phase === "answering",
  deadline: () => props.currentRound.deadline,
  duration: () => props.state.answer_duration,
});

function submit(suggestionId: string) {
  if (!canAnswerRound.value) return;
  emit("submit", {
    answer_type: "multiple_choice",
    suggestion_id: suggestionId,
  });
}
</script>
