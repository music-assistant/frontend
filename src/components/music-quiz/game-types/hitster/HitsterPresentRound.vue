<template>
  <HitsterTimelineView
    class="min-h-0 flex-1"
    :round="currentRound"
    :presentation="true"
  />
</template>

<script setup lang="ts">
import type { MusicQuizPresentGameAdapterProps } from "@/components/music-quiz/adapter_contracts";
import HitsterTimelineView from "@/components/music-quiz/game-types/hitster/HitsterTimelineView.vue";
import type {
  MusicQuizHitsterHostState,
  MusicQuizTimelineRound,
} from "@/composables/useMusicQuiz";

defineProps<
  MusicQuizPresentGameAdapterProps<
    MusicQuizHitsterHostState,
    MusicQuizTimelineRound
  >
>();
</script>
