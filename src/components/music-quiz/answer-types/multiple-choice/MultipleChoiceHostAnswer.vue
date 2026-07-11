<template>
  <Card v-if="state.phase === 'answering'">
    <CardContent class="flex flex-col items-center gap-4">
      <MusicQuizCountdown
        :size="120"
        :fraction="remainingFraction"
        :label="remainingLabel || '…'"
      />
      <MultipleChoiceGrid
        class="w-full"
        :suggestions="currentRound.suggestions"
        :disabled="true"
        :selected-suggestion-id="null"
        @select="noop"
      />
    </CardContent>
  </Card>

  <div
    v-if="state.phase === 'answering' || state.phase === 'reveal'"
    class="grid gap-4 lg:grid-cols-2"
  >
    <MultipleChoiceProgress
      :statuses="roundPlayerStatuses"
      :answered-count="answeredPlayerCount"
    />
    <slot name="leaderboard" />
  </div>
</template>

<script setup lang="ts">
import type {
  MusicQuizAnswerAdapterSlots,
  MusicQuizHostAnswerAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import MultipleChoiceGrid from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceGrid.vue";
import MultipleChoiceProgress from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceProgress.vue";
import MusicQuizCountdown from "@/components/music-quiz/MusicQuizCountdown.vue";
import { Card, CardContent } from "@/components/ui/card";
import type {
  MusicQuizMultipleChoiceHostState,
  MusicQuizMultipleChoiceRound,
} from "@/composables/useMusicQuiz";
import { useMusicQuizAnswerDeadline } from "@/composables/useMusicQuizAnswerDeadline";
import { getMusicQuizRoundPlayers } from "@/helpers/music_quiz";
import { computed } from "vue";

const props =
  defineProps<
    MusicQuizHostAnswerAdapterProps<
      MusicQuizMultipleChoiceHostState,
      MusicQuizMultipleChoiceRound
    >
  >();
defineSlots<MusicQuizAnswerAdapterSlots>();

const roundPlayerStatuses = computed(() =>
  getMusicQuizRoundPlayers(
    props.state.players,
    props.currentRound.round_index,
  ).sort((a, b) => a.name.localeCompare(b.name)),
);
const answeredPlayerCount = computed(
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
