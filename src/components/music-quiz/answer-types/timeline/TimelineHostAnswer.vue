<template>
  <TimelineAudienceAnswer :state="state" :current-round="currentRound">
    <template #leaderboard>
      <slot name="leaderboard" />
    </template>
  </TimelineAudienceAnswer>
</template>

<script setup lang="ts">
import TimelineAudienceAnswer from "@/components/music-quiz/answer-types/timeline/TimelineAudienceAnswer.vue";
import type {
  MusicQuizAnswerAdapterSlots,
  MusicQuizHostAnswerAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import type {
  MusicQuizTimelineHostState,
  MusicQuizTimelineRound,
} from "@/composables/useMusicQuiz";

defineProps<
  MusicQuizHostAnswerAdapterProps<
    MusicQuizTimelineHostState,
    MusicQuizTimelineRound
  >
>();
defineSlots<MusicQuizAnswerAdapterSlots>();
</script>
