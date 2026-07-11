<template>
  <HitsterTimelineView :round="currentRound" />
</template>

<script setup lang="ts">
import type { MusicQuizHostGameAdapterProps } from "@/components/music-quiz/adapter_contracts";
import HitsterTimelineView from "@/components/music-quiz/game-types/hitster/HitsterTimelineView.vue";
import type {
  MusicQuizHitsterHostState,
  MusicQuizTimelineRound,
} from "@/composables/useMusicQuiz";

defineProps<
  MusicQuizHostGameAdapterProps<
    MusicQuizHitsterHostState,
    MusicQuizTimelineRound
  >
>();
</script>
