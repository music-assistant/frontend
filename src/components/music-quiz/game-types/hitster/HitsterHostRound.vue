<template>
  <HitsterRound
    :phase="state.phase"
    :round="currentRound"
    :is-final-round="currentRound.round_index + 1 >= state.round_count"
  />
</template>

<script setup lang="ts">
import type { MusicQuizHostGameAdapterProps } from "@/components/music-quiz/adapter_contracts";
import HitsterRound from "@/components/music-quiz/game-types/hitster/HitsterRound.vue";
import type {
  MusicQuizHitsterHostState,
  MusicQuizHitsterRound,
} from "@/composables/useMusicQuiz";

defineProps<
  MusicQuizHostGameAdapterProps<
    MusicQuizHitsterHostState,
    MusicQuizHitsterRound
  >
>();
</script>
