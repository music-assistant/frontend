<template>
  <section class="quiz-leaderboard">
    <h2>{{ $t("providers.music_quiz.leaderboard") }}</h2>
    <ol>
      <li
        v-for="player in rows"
        :key="player.name"
        :class="{ 'is-current-player': player.name === currentPlayerName }"
        :aria-current="player.name === currentPlayerName ? 'true' : undefined"
      >
        <span class="quiz-leaderboard__name">
          <small>#{{ player.rank }}</small>
          {{ player.name }}
        </span>
        <strong class="quiz-leaderboard__score">
          {{ player.score }}
          <span v-if="player.roundScoreLabel">
            {{ player.roundScoreLabel }}
          </span>
        </strong>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import type { RankedMusicQuizPlayer } from "@/helpers/music_quiz";

export type MusicQuizLeaderboardRow = RankedMusicQuizPlayer & {
  roundScoreLabel: string;
};

defineProps<{
  rows: MusicQuizLeaderboardRow[];
  currentPlayerName?: string;
}>();
</script>

<style scoped>
.quiz-leaderboard {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  padding: 0.875rem;
}

.quiz-leaderboard h2 {
  margin: 0;
  font-size: 1rem;
}

.quiz-leaderboard ol {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.quiz-leaderboard li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-inline: -0.5rem;
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
}

.quiz-leaderboard span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.quiz-leaderboard li.is-current-player {
  background: color-mix(in srgb, var(--primary) 12%, transparent);
}

.quiz-leaderboard li.is-current-player .quiz-leaderboard__name {
  color: var(--primary);
  font-weight: 800;
}

.quiz-leaderboard li.is-current-player small {
  color: var(--primary);
}

.quiz-leaderboard small {
  margin-right: 0.5rem;
  color: var(--muted-foreground);
}

.quiz-leaderboard__score {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: baseline;
  gap: 0.35rem;
  white-space: nowrap;
}

.quiz-leaderboard__score span {
  color: var(--primary);
  font-size: 0.8rem;
}
</style>
