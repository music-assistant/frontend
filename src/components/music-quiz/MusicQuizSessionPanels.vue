<template>
  <div
    v-if="state.phase !== 'finished'"
    class="grid gap-4"
    :class="{ 'lg:grid-cols-2': showRoundPlayerStatus }"
  >
    <MusicQuizAnswerStatus
      v-if="showRoundPlayerStatus"
      :statuses="roundPlayerStatuses"
      :answered-count="answeredPlayerCount"
    />
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
import MusicQuizAnswerStatus from "@/components/music-quiz/MusicQuizAnswerStatus.vue";
import MusicQuizLeaderboard, {
  type MusicQuizLeaderboardRow,
} from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import type { MusicQuizHostState } from "@/composables/useMusicQuiz";
import {
  getMusicQuizRoundScoreLabel,
  getMusicQuizWinnerText,
  rankMusicQuizPlayers,
} from "@/helpers/music_quiz";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const props = defineProps<{ state: MusicQuizHostState }>();

const currentRound = computed(() => props.state.current_round ?? null);

const leaderboardRows = computed<MusicQuizLeaderboardRow[]>(() =>
  rankMusicQuizPlayers(props.state.players).map((player) => ({
    ...player,
    roundScoreLabel: getMusicQuizRoundScoreLabel(props.state, player.name),
  })),
);

const winnerText = computed(() =>
  getMusicQuizWinnerText(rankMusicQuizPlayers(props.state.players)),
);

const showRoundPlayerStatus = computed(
  () =>
    !!currentRound.value &&
    (props.state.phase === "answering" || props.state.phase === "reveal"),
);

const roundPlayerStatuses = computed(() => {
  const roundIndex = currentRound.value?.round_index;
  if (roundIndex === undefined) return [];
  return props.state.players
    .filter((player) => (player.active_from_round ?? 0) <= roundIndex)
    .sort((a, b) => a.name.localeCompare(b.name));
});

const answeredPlayerCount = computed(
  () => roundPlayerStatuses.value.filter((player) => player.answered).length,
);
</script>
