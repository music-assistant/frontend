<template>
  <MusicTimelineRound
    :phase="state.phase"
    :round="currentRound"
    :is-final-round="currentRound.round_index + 1 >= state.round_count"
  />
</template>

<script setup lang="ts">
import type { MusicQuizPresentGameAdapterProps } from "@/components/music-quiz/adapter_contracts";
import MusicTimelineRound from "@/components/music-quiz/game-types/music-timeline/MusicTimelineRound.vue";
import type {
  MusicQuizTimelineHostState,
  MusicQuizTimelineRound,
} from "@/composables/useMusicQuiz";

defineProps<
  MusicQuizPresentGameAdapterProps<
    MusicQuizTimelineHostState,
    MusicQuizTimelineRound
  >
>();
</script>
