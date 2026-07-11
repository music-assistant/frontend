<template>
  <HitsterRound :phase="state.phase" :round="currentRound" />
</template>

<script setup lang="ts">
import type { MusicQuizPresentGameAdapterProps } from "@/components/music-quiz/adapter_contracts";
import HitsterRound from "@/components/music-quiz/game-types/hitster/HitsterRound.vue";
import type {
  MusicQuizHitsterHostState,
  MusicQuizHitsterRound,
} from "@/composables/useMusicQuiz";

defineProps<
  MusicQuizPresentGameAdapterProps<
    MusicQuizHitsterHostState,
    MusicQuizHitsterRound
  >
>();
</script>
