<template>
  <Card v-if="state.phase === 'answering'">
    <CardContent class="flex flex-col items-center gap-4">
      <MusicQuizCountdown
        :size="120"
        :fraction="remainingFraction"
        :label="remainingLabel || '…'"
      />
      <HintTextMask :mask="currentRound.mask" />
      <HintTextHintStatus :round="currentRound" />
    </CardContent>
  </Card>

  <div
    v-if="state.phase === 'answering' || state.phase === 'reveal'"
    class="grid gap-4 lg:grid-cols-2"
  >
    <HintTextProgress :statuses="roundPlayerStatuses" />
    <slot name="leaderboard"></slot>
  </div>
</template>

<script setup lang="ts">
import type {
  MusicQuizAnswerAdapterSlots,
  MusicQuizHostAnswerAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import HintTextHintStatus from "@/components/music-quiz/answer-types/hint-text/HintTextHintStatus.vue";
import HintTextMask from "@/components/music-quiz/answer-types/hint-text/HintTextMask.vue";
import HintTextProgress from "@/components/music-quiz/answer-types/hint-text/HintTextProgress.vue";
import MusicQuizCountdown from "@/components/music-quiz/MusicQuizCountdown.vue";
import { Card, CardContent } from "@/components/ui/card";
import type {
  MusicQuizTitleRevealHostState,
  MusicQuizTitleRevealRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { useMusicQuizAnswerDeadline } from "@/composables/music-quiz/useMusicQuizAnswerDeadline";
import { getMusicQuizRoundPlayers } from "@/helpers/music_quiz";
import { computed } from "vue";

const props =
  defineProps<
    MusicQuizHostAnswerAdapterProps<
      MusicQuizTitleRevealHostState,
      MusicQuizTitleRevealRound
    >
  >();
defineSlots<MusicQuizAnswerAdapterSlots>();

const roundPlayerStatuses = computed(() =>
  getMusicQuizRoundPlayers(
    props.state.players,
    props.currentRound.round_index,
  ).sort((a, b) => a.name.localeCompare(b.name)),
);
const { remainingLabel, remainingFraction } = useMusicQuizAnswerDeadline({
  active: () => props.state.phase === "answering",
  deadline: () => props.currentRound.deadline,
  duration: () => props.state.answer_duration,
});
</script>
