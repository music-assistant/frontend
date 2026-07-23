<template>
  <section v-if="state.phase === 'lobby'" class="flex flex-col gap-3">
    <MusicQuizAutoStartStatus
      v-if="state.auto_start_at != null"
      :state="state"
      class="text-muted-foreground text-center"
    />
    <p v-else class="text-muted-foreground text-center">
      {{ $t("providers.music_quiz.waiting_for_start") }}
    </p>
    <MusicQuizLeaderboard
      :rows="leaderboardRows"
      :current-player-name="state.you.name"
    />
  </section>

  <section
    v-else-if="
      (state.phase === 'answering' || state.phase === 'reveal') && currentRound
    "
    class="flex flex-col gap-3"
  >
    <component
      :is="gameComponent"
      :state="state"
      :current-round="currentRound"
      :busy="busy"
      @ready="emit('ready')"
    />
    <component
      :is="answerComponent"
      :state="state"
      :current-round="currentRound"
      :busy="busy"
      @submit="onSubmitAnswer"
    />
    <MusicQuizLeaderboard
      :rows="leaderboardRows"
      :current-player-name="state.you.name"
      compact
    />
  </section>

  <section v-else-if="state.phase === 'finished'" class="flex flex-col gap-4">
    <div class="flex flex-col items-center gap-1 text-center">
      <Trophy class="size-8 text-yellow-400" />
      <h2 class="text-xl font-bold">
        {{ $t("providers.music_quiz.game_over") }}
      </h2>
      <p class="text-muted-foreground">{{ winnerText }}</p>
    </div>
    <MusicQuizPodium v-if="leaderboardRows.length" :rows="leaderboardRows" />
    <MusicQuizLeaderboard
      :rows="leaderboardRows"
      :current-player-name="state.you.name"
    />
  </section>
</template>

<script setup lang="ts">
import MusicQuizAutoStartStatus from "@/components/music-quiz/MusicQuizAutoStartStatus.vue";
import MusicQuizLeaderboard, {
  type MusicQuizLeaderboardRow,
} from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import MusicQuizPodium from "@/components/music-quiz/MusicQuizPodium.vue";
import type {
  MusicQuizAnswerSubmission,
  MusicQuizCurrentRound,
  MusicQuizSupportedPersonalizedState,
} from "@/composables/music-quiz/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { Trophy } from "@lucide/vue";
import type { Component } from "vue";

defineProps<{
  state: MusicQuizSupportedPersonalizedState;
  currentRound: MusicQuizCurrentRound | null;
  busy: boolean;
  leaderboardRows: MusicQuizLeaderboardRow[];
  winnerText: string;
  gameComponent: Component;
  answerComponent: Component;
}>();
const emit = defineEmits<{
  "submit-answer": [submission: MusicQuizAnswerSubmission];
  ready: [];
}>();

function onSubmitAnswer(submission: MusicQuizAnswerSubmission) {
  emit("submit-answer", submission);
}
</script>
