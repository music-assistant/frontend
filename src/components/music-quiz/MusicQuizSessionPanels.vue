<template>
  <section
    class="quiz-panels"
    :class="{ 'quiz-panels--finished': state.phase === 'finished' }"
  >
    <div v-if="state.phase !== 'finished'" class="quiz-panels__panel">
      <h2>{{ $t("providers.music_quiz.round") }}</h2>
      <p v-if="currentRound">
        {{ currentRound.round_index + 1 }} / {{ state.round_count }}
      </p>
      <div v-if="showRoundPlayerStatus" class="quiz-panels__answer-status">
        <header>
          <span>{{ $t("providers.music_quiz.answers") }}</span>
          <small>
            {{ answeredPlayerCount }} / {{ roundPlayerStatuses.length }}
          </small>
        </header>
        <ul>
          <li
            v-for="player in roundPlayerStatuses"
            :key="player.name"
            :class="{ 'is-answered': player.answered }"
          >
            <Check v-if="player.answered" class="size-4" />
            <Clock v-else class="size-4" />
            <span>{{ player.name }}</span>
          </li>
        </ul>
      </div>
    </div>

    <div class="quiz-panels__panel">
      <h2>
        {{
          state.phase === "finished"
            ? $t("providers.music_quiz.final_leaderboard")
            : $t("players")
        }}
      </h2>
      <p v-if="state.phase === 'finished'">
        {{ winnerText }}
      </p>
      <ol class="quiz-panels__leaderboard">
        <li v-for="player in rankedLeaderboard" :key="player.name">
          <span>
            <small>#{{ player.rank }}</small>
            {{ player.name }}
          </span>
          <strong>{{ player.score }}</strong>
        </li>
      </ol>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { MusicQuizHostState } from "@/composables/useMusicQuiz";
import {
  getMusicQuizWinnerText,
  rankMusicQuizPlayers,
} from "@/helpers/music_quiz";
import { $t } from "@/plugins/i18n";
import { Check, Clock } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{ state: MusicQuizHostState }>();

const currentRound = computed(() => props.state.current_round ?? null);
const rankedLeaderboard = computed(() =>
  rankMusicQuizPlayers(
    [...props.state.players].sort((a, b) => b.score - a.score),
  ),
);
const winnerText = computed(() =>
  getMusicQuizWinnerText(rankedLeaderboard.value),
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

<style scoped>
.quiz-panels {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 420px);
  gap: 1rem;
}

.quiz-panels--finished {
  grid-template-columns: minmax(0, 1fr);
}

.quiz-panels__panel {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  padding: 1rem;
}

.quiz-panels__answer-status {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}

.quiz-panels__answer-status header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-weight: 600;
}

.quiz-panels__answer-status small {
  color: var(--muted-foreground);
}

.quiz-panels__answer-status ul {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.quiz-panels__answer-status li {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--background);
  padding: 0.55rem 0.65rem;
  color: var(--muted-foreground);
}

.quiz-panels__answer-status li.is-answered {
  color: var(--foreground);
}

.quiz-panels__answer-status svg {
  flex: 0 0 auto;
}

.quiz-panels__answer-status li.is-answered svg {
  color: var(--primary);
}

.quiz-panels__answer-status li span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.quiz-panels__leaderboard {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.quiz-panels__leaderboard li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.quiz-panels__leaderboard span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.quiz-panels__leaderboard small {
  margin-right: 0.5rem;
  color: var(--muted-foreground);
}

@media (max-width: 800px) {
  .quiz-panels {
    grid-template-columns: 1fr;
  }
}
</style>
