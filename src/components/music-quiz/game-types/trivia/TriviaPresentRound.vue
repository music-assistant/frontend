<template>
  <TriviaQuestion class="flex-1" :round="currentRound" present />
</template>

<script setup lang="ts">
import type { MusicQuizPresentGameAdapterProps } from "@/components/music-quiz/adapter_contracts";
import TriviaQuestion from "@/components/music-quiz/game-types/trivia/TriviaQuestion.vue";
import type {
  MusicQuizTriviaHostState,
  MusicQuizTriviaRound,
} from "@/composables/useMusicQuiz";

defineProps<
  MusicQuizPresentGameAdapterProps<
    MusicQuizTriviaHostState,
    MusicQuizTriviaRound
  >
>();
</script>
