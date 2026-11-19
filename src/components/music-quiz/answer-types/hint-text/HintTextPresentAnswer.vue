<template>
  <template v-if="state.phase === 'answering'">
    <div class="flex flex-col items-center gap-6">
      <MusicQuizCountdown
        :size="160"
        :fraction="remainingFraction"
        :label="remainingLabel || '…'"
      />
      <HintTextMask :mask="currentRound.mask" size="lg" />
      <HintTextHintStatus :round="currentRound" />
    </div>
    <div
      data-testid="hint-text-present-panels"
      class="grid min-h-0 flex-1 gap-4 lg:grid-cols-2 lg:overflow-hidden"
    >
      <HintTextProgress :statuses="roundPlayerStatuses" scrollable />
      <slot name="leaderboard"></slot>
    </div>
  </template>
  <template v-else-if="state.phase === 'reveal'">
    <slot name="leaderboard"></slot>
  </template>
</template>

<script setup lang="ts">
import type {
  MusicQuizAnswerAdapterSlots,
  MusicQuizPresentAnswerAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import HintTextHintStatus from "@/components/music-quiz/answer-types/hint-text/HintTextHintStatus.vue";
import HintTextMask from "@/components/music-quiz/answer-types/hint-text/HintTextMask.vue";
import HintTextProgress from "@/components/music-quiz/answer-types/hint-text/HintTextProgress.vue";
import MusicQuizCountdown from "@/components/music-quiz/MusicQuizCountdown.vue";
import type {
  MusicQuizTitleRevealPublicState,
  MusicQuizTitleRevealRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { useMusicQuizAnswerDeadline } from "@/composables/music-quiz/useMusicQuizAnswerDeadline";
import { getMusicQuizRoundPlayers } from "@/helpers/music_quiz";
import { computed } from "vue";

const props =
  defineProps<
    MusicQuizPresentAnswerAdapterProps<
      MusicQuizTitleRevealPublicState,
      MusicQuizTitleRevealRound
    >
  >();
defineSlots<MusicQuizAnswerAdapterSlots>();

const roundPlayerStatuses = computed(() =>
  getMusicQuizRoundPlayers(props.state.players, props.currentRound.round_index),
);
const { remainingLabel, remainingFraction } = useMusicQuizAnswerDeadline({
  active: () => props.state.phase === "answering",
  deadline: () => props.currentRound.deadline,
  duration: () => props.state.answer_duration,
});
</script>
