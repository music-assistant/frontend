<template>
  <TimelineAudienceAnswer
    :state="state"
    :current-round="currentRound"
    :present="true"
  >
    <template #leaderboard>
      <slot name="leaderboard" />
    </template>
  </TimelineAudienceAnswer>
</template>

<script setup lang="ts">
import TimelineAudienceAnswer from "@/components/music-quiz/answer-types/timeline/TimelineAudienceAnswer.vue";
import type {
  MusicQuizAnswerAdapterSlots,
  MusicQuizPresentAnswerAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import type {
  MusicQuizTimelineHostState,
  MusicQuizTimelineRound,
} from "@/composables/useMusicQuiz";

defineProps<
  MusicQuizPresentAnswerAdapterProps<
    MusicQuizTimelineHostState,
    MusicQuizTimelineRound
  >
>();
defineSlots<MusicQuizAnswerAdapterSlots>();
</script>
