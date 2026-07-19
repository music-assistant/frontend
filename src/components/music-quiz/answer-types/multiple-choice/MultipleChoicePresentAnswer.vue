<template>
  <template v-if="state.phase === 'answering'">
    <div class="flex flex-col items-center gap-2">
      <MusicQuizCountdown
        :size="160"
        :fraction="remainingFraction"
        :label="remainingLabel || '…'"
      />
    </div>
    <div
      class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]"
    >
      <MultipleChoiceGrid
        :suggestions="currentRound.suggestions"
        :disabled="true"
        :selected-suggestion-id="null"
        @select="noop"
      />
      <div
        data-testid="multiple-choice-present-panels"
        class="flex flex-col gap-4 lg:grid lg:min-h-0 lg:grid-rows-[minmax(7rem,2fr)_minmax(9rem,3fr)] lg:overflow-hidden"
      >
        <MultipleChoiceProgress
          :statuses="roundPlayerStatuses"
          :answered-count="answeredCount"
          scrollable
        />
        <slot name="leaderboard" />
      </div>
    </div>
  </template>
  <template v-else-if="state.phase === 'reveal'">
    <slot name="leaderboard" />
  </template>
</template>

<script setup lang="ts">
import type {
  MusicQuizAnswerAdapterSlots,
  MusicQuizPresentAnswerAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import MultipleChoiceGrid from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceGrid.vue";
import MultipleChoiceProgress from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceProgress.vue";
import MusicQuizCountdown from "@/components/music-quiz/MusicQuizCountdown.vue";
import type {
  MusicQuizMultipleChoiceHostState,
  MusicQuizMultipleChoiceRound,
} from "@/composables/useMusicQuiz";
import { useMusicQuizAnswerDeadline } from "@/composables/useMusicQuizAnswerDeadline";
import { getMusicQuizRoundPlayers } from "@/helpers/music_quiz";
import { computed } from "vue";

const props =
  defineProps<
    MusicQuizPresentAnswerAdapterProps<
      MusicQuizMultipleChoiceHostState,
      MusicQuizMultipleChoiceRound
    >
  >();
defineSlots<MusicQuizAnswerAdapterSlots>();

const roundPlayerStatuses = computed(() =>
  getMusicQuizRoundPlayers(props.state.players, props.currentRound.round_index),
);
const answeredCount = computed(
  () => roundPlayerStatuses.value.filter((player) => player.answered).length,
);
const { remainingLabel, remainingFraction } = useMusicQuizAnswerDeadline({
  active: () => props.state.phase === "answering",
  deadline: () => props.currentRound.deadline,
  duration: () => props.state.answer_duration,
});

function noop() {
  // Read-only interaction.
}
</script>
