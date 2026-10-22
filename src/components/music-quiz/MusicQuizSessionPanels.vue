<template>
  <div v-if="state.phase !== 'finished'" class="grid gap-4">
    <MusicQuizLeaderboard :rows="leaderboardRows" :title="$t('players')" />
  </div>

  <div v-else class="flex flex-col gap-3">
    <p class="text-muted-foreground text-center">{{ winnerText }}</p>
    <MusicQuizLeaderboard
      :rows="leaderboardRows"
      :title="$t('providers.music_quiz.final_leaderboard')"
    />
  </div>
</template>

<script setup lang="ts">
import MusicQuizLeaderboard, {
  type MusicQuizLeaderboardRow,
} from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import type { MusicQuizSupportedHostState } from "@/composables/music-quiz/useMusicQuiz";
import {
  getMusicQuizRoundScoreLabel,
  getMusicQuizWinnerText,
  rankMusicQuizPlayers,
} from "@/helpers/music_quiz";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const props = defineProps<{ state: MusicQuizSupportedHostState }>();

const leaderboardRows = computed<MusicQuizLeaderboardRow[]>(() =>
  rankMusicQuizPlayers(props.state.players).map((player) => ({
    ...player,
    roundScoreLabel: getMusicQuizRoundScoreLabel(props.state, player.name),
  })),
);

const winnerText = computed(() =>
  getMusicQuizWinnerText(rankMusicQuizPlayers(props.state.players)),
);
</script>
