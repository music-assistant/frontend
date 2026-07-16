<template>
  <TriviaQuestion :round="currentRound" />
</template>

<script setup lang="ts">
import type { MusicQuizHostGameAdapterProps } from "@/components/music-quiz/adapter_contracts";
import TriviaQuestion from "@/components/music-quiz/game-types/trivia/TriviaQuestion.vue";
import type {
  MusicQuizTriviaHostState,
  MusicQuizTriviaRound,
} from "@/composables/useMusicQuiz";

defineProps<
  MusicQuizHostGameAdapterProps<MusicQuizTriviaHostState, MusicQuizTriviaRound>
>();
</script>
