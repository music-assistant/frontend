<template>
  <template v-if="state.phase === 'answering'">
    <div class="flex flex-col items-center gap-2">
      <MusicQuizCountdown
        :size="148"
        :fraction="remainingFraction"
        :label="remainingLabel || '...'"
      />
    </div>
    <div class="grid gap-4 lg:grid-cols-2">
      <TimelineProgress :statuses="state.players" />
      <slot name="leaderboard" />
    </div>
  </template>
</template>

<script setup lang="ts">
import TimelineProgress from "@/components/music-quiz/answer-types/timeline/TimelineProgress.vue";
import type {
  MusicQuizAnswerAdapterSlots,
  MusicQuizPresentAnswerAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import MusicQuizCountdown from "@/components/music-quiz/MusicQuizCountdown.vue";
import type {
  MusicQuizHitsterHostState,
  MusicQuizTimelineRound,
} from "@/composables/useMusicQuiz";
import { useMusicQuizAnswerDeadline } from "@/composables/useMusicQuizAnswerDeadline";

const props =
  defineProps<
    MusicQuizPresentAnswerAdapterProps<
      MusicQuizHitsterHostState,
      MusicQuizTimelineRound
    >
  >();
defineSlots<MusicQuizAnswerAdapterSlots>();

const { remainingLabel, remainingFraction } = useMusicQuizAnswerDeadline({
  active: () => props.state.phase === "answering",
  deadline: () => props.currentRound.deadline,
  duration: () => props.state.answer_duration,
});
</script>
