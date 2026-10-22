<template>
  <TimelineAudienceAnswer
    :state="state"
    :current-round="currentRound"
    :present="true"
  >
    <template #leaderboard>
      <slot name="leaderboard"></slot>
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
  MusicQuizTimelinePublicState,
  MusicQuizTimelineRound,
} from "@/composables/music-quiz/useMusicQuiz";

defineProps<
  MusicQuizPresentAnswerAdapterProps<
    MusicQuizTimelinePublicState,
    MusicQuizTimelineRound
  >
>();
defineSlots<MusicQuizAnswerAdapterSlots>();
</script>
