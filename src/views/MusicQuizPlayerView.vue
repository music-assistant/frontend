<template>
  <div class="music-quiz-player">
    <div v-if="gameRemoved" class="quiz-shell">
      <p>{{ $t("music_quiz.game_no_longer_available") }}</p>
    </div>

    <div v-else-if="!playerId && !loading" class="quiz-shell quiz-shell--join">
      <header class="quiz-shell__intro">
        <h1>{{ $t("music_quiz.title") }}</h1>
        <p v-if="info?.name">{{ info.name }}</p>
        <div v-if="info" class="quiz-shell__stats">
          <span>{{ $t("music_quiz.players_count", [info.player_count]) }}</span>
          <span>{{ $t("music_quiz.rounds_count", [info.round_count]) }}</span>
          <span>{{ modeLabel }}</span>
        </div>
      </header>
      <MusicQuizJoinForm
        :session-name="info?.name || $t('music_quiz.title')"
        :busy="busy"
        @join="handleJoin"
      />
    </div>

    <div v-else-if="state" class="quiz-shell quiz-shell--game">
      <MusicQuizConnectionBanners :degraded="isConnectionDegraded" />

      <MusicQuizPlayerHeader
        :player-name="state.you.name"
        :rank="playerRank"
        :round-progress="roundProgress"
        :score="state.you.score"
        :score-delta="playerRoundScoreLabel"
        :phase-label="phaseText"
      />

      <section
        v-if="listenIn.shouldShowListenInToggle.value"
        class="quiz-shell__listen-in"
      >
        <div class="quiz-shell__listen-in-copy">
          <strong>{{ $t("music_quiz.listen_in") }}</strong>
          <small>{{ listenInDescription }}</small>
        </div>
        <Switch
          :model-value="listenIn.isListeningIn.value"
          :disabled="listenIn.busy.value"
          @update:model-value="handleListenInToggle"
        />
      </section>

      <section v-if="state.phase === 'lobby'" class="quiz-shell__section">
        <p class="quiz-shell__hint">{{ $t("music_quiz.waiting_for_start") }}</p>
        <MusicQuizLeaderboard
          :rows="leaderboardRows"
          :current-player-name="state.you.name"
        />
      </section>

      <section
        v-else-if="state.phase === 'answering' && currentRound"
        class="quiz-shell__section"
      >
        <p class="quiz-shell__title">{{ $t("music_quiz.choose_answer") }}</p>
        <p class="quiz-shell__countdown">
          {{ answerRemainingLabel || $t("music_quiz.waiting_for_answers") }}
        </p>
        <MusicQuizAnswerGrid
          class="quiz-shell__answers"
          :suggestions="currentRound.suggestions"
          :disabled="busy || !!state.you.answer"
          :selected-suggestion-id="state.you.answer?.suggestion_id ?? null"
          @select="handleAnswer"
        />
        <p v-if="state.you.answer" class="quiz-shell__hint">
          {{ $t("music_quiz.answered") }}
        </p>
        <MusicQuizAnswerStatus
          :statuses="state.players"
          :answered-count="answeredCount"
        />
      </section>

      <section
        v-else-if="state.phase === 'reveal' && currentRound"
        class="quiz-shell__section"
      >
        <MusicQuizReveal
          :round="currentRound"
          :busy="busy"
          :is-ready="state.you.ready"
          :ready-label="readyLabel"
          :image-url="currentRoundImageUrl"
          :show-lyrics="true"
          :has-lyrics="hasRevealLyrics"
          :lyrics="revealLyrics || ''"
          :lrc-lyrics="revealLrcLyrics || ''"
          :lyrics-position="lyricsPosition"
          :lyrics-text-color="'hsl(var(--foreground))'"
          @ready="handleReady"
          @copy-title="copyCurrentRoundTitle"
        />

        <p
          v-if="state.you.answer?.correct"
          class="quiz-shell__answer-result quiz-shell__answer-result--correct"
        >
          {{ $t("music_quiz.correct") }}
          <span>+{{ state.you.answer.points ?? 0 }}</span>
        </p>
        <p
          v-else
          class="quiz-shell__answer-result quiz-shell__answer-result--incorrect"
        >
          {{
            state.you.answer
              ? $t("music_quiz.incorrect")
              : $t("music_quiz.no_answer_submitted")
          }}
        </p>

        <MusicQuizLeaderboard
          :rows="leaderboardRows"
          :current-player-name="state.you.name"
        />
      </section>

      <section
        v-else-if="state.phase === 'finished'"
        class="quiz-shell__section"
      >
        <h2 class="quiz-shell__title">{{ $t("music_quiz.game_over") }}</h2>
        <p class="quiz-shell__hint">{{ winnerText }}</p>
        <MusicQuizLeaderboard
          :rows="leaderboardRows"
          :current-player-name="state.you.name"
        />
      </section>
    </div>

    <div v-else class="quiz-shell">
      <p>{{ $t("music_quiz.loading") }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import MusicQuizAnswerGrid from "@/components/music-quiz/MusicQuizAnswerGrid.vue";
import MusicQuizAnswerStatus from "@/components/music-quiz/MusicQuizAnswerStatus.vue";
import MusicQuizConnectionBanners from "@/components/music-quiz/MusicQuizConnectionBanners.vue";
import MusicQuizJoinForm from "@/components/music-quiz/MusicQuizJoinForm.vue";
import MusicQuizLeaderboard, {
  type MusicQuizLeaderboardRow,
} from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import MusicQuizPlayerHeader from "@/components/music-quiz/MusicQuizPlayerHeader.vue";
import MusicQuizReveal from "@/components/music-quiz/MusicQuizReveal.vue";
import { Switch } from "@/components/ui/switch";
import { useMusicQuizListenIn } from "@/composables/useMusicQuizListenIn";
import { useMusicQuizPlayer } from "@/composables/useMusicQuizPlayer";
import { useMusicQuizRoundClocks } from "@/composables/useMusicQuizRoundClocks";
import {
  getMusicQuizRoundScoreLabel,
  getMusicQuizWinnerText,
  rankMusicQuizPlayers,
} from "@/helpers/music_quiz";
import { copyToClipboard, getMediaImageUrl } from "@/helpers/utils";
import api, { ConnectionState } from "@/plugins/api";
import { MediaType, type Track } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { toast } from "vue-sonner";

const player = useMusicQuizPlayer({
  notifyError: (message) => toast.error(message),
});

const { info, state, playerId, gameRemoved, busy, loading, currentRound } =
  player;

const clocks = useMusicQuizRoundClocks(
  computed(() => state.value),
  computed(() => currentRound.value),
);
const { answerRemainingLabel, lyricsPosition } = clocks;

const mode = computed(() => state.value?.mode ?? info.value?.mode);
const modeLabel = computed(() =>
  mode.value === "remote"
    ? $t("music_quiz.mode_remote")
    : $t("music_quiz.mode_venue"),
);

const listenIn = useMusicQuizListenIn({
  mode: () => mode.value,
  notifyError: (message) => toast.error(message),
});
const listenInDescription = computed(() => {
  if (mode.value === "remote") return $t("music_quiz.listen_in_remote");
  return $t("music_quiz.listen_in_venue");
});

const rankedPlayers = computed(() => {
  if (!state.value) return [];
  return rankMusicQuizPlayers(state.value.players);
});

const playerRank = computed(() => {
  const currentState = state.value;
  if (!currentState) return null;
  return (
    rankedPlayers.value.find((row) => row.name === currentState.you.name)
      ?.rank ?? null
  );
});

const leaderboardRows = computed<MusicQuizLeaderboardRow[]>(() => {
  const currentState = state.value;
  if (!currentState) return [];
  return rankedPlayers.value.map((playerRow) => ({
    ...playerRow,
    roundScoreLabel: getMusicQuizRoundScoreLabel(currentState, playerRow.name),
  }));
});

const answeredCount = computed(
  () =>
    state.value?.players.filter((playerRow) => playerRow.answered).length ?? 0,
);
const winnerText = computed(() => getMusicQuizWinnerText(rankedPlayers.value));

const roundProgress = computed(() => {
  if (!state.value) return "";
  if (!currentRound.value) {
    return `${$t("music_quiz.round_label")} ${state.value.round_count}/${state.value.round_count}`;
  }
  return `${$t("music_quiz.round_label")} ${currentRound.value.round_index + 1}/${state.value.round_count}`;
});

const playerRoundScoreLabel = computed(() => {
  if (!state.value) return "";
  return getMusicQuizRoundScoreLabel(state.value, state.value.you.name);
});

const readyLabel = computed(() => {
  if (state.value?.you.ready) return $t("music_quiz.waiting_for_next");
  return $t("music_quiz.ready");
});

const phaseText = computed(() => {
  if (!state.value) return "";
  if (state.value.phase === "lobby")
    return $t("music_quiz.phase_waiting_for_players");
  if (state.value.phase === "answering")
    return $t("music_quiz.phase_answers_open");
  if (state.value.phase === "reveal") return $t("music_quiz.phase_enjoy_track");
  return $t("music_quiz.phase_finished");
});

const currentRoundImageUrl = computed(() =>
  getMediaImageUrl(currentRound.value?.image_url ?? ""),
);

const isConnectionDegraded = computed(
  () =>
    api.state.value === ConnectionState.RECONNECTING ||
    api.state.value === ConnectionState.DISCONNECTED,
);

const revealLyrics = ref<string | null>(null);
const revealLrcLyrics = ref<string | null>(null);
const hasRevealLyrics = computed(
  () => !!(revealLyrics.value || revealLrcLyrics.value),
);
let lyricsRequestCounter = 0;

async function loadRevealLyrics(trackUri: string) {
  const requestId = ++lyricsRequestCounter;
  revealLyrics.value = null;
  revealLrcLyrics.value = null;
  try {
    const item = await api.getItemByUri(trackUri);
    if (requestId !== lyricsRequestCounter) return;
    if (item.media_type !== MediaType.TRACK) return;
    const [lyrics, lrcLyrics] = await api.getTrackLyrics(item as Track);
    if (requestId !== lyricsRequestCounter) return;
    revealLyrics.value = lyrics;
    revealLrcLyrics.value = lrcLyrics;
  } catch (error) {
    if (requestId === lyricsRequestCounter) {
      console.warn("Failed to load quiz lyrics:", error);
    }
  }
}

watch(
  () => [state.value?.phase, currentRound.value?.track_uri] as const,
  ([phase, trackUri]) => {
    if (phase !== "reveal" || !trackUri) {
      lyricsRequestCounter += 1;
      revealLyrics.value = null;
      revealLrcLyrics.value = null;
      return;
    }
    void loadRevealLyrics(trackUri);
  },
  { immediate: true },
);

watch(
  () => listenIn.shouldPromptListenIn.value,
  (shouldPrompt) => {
    if (shouldPrompt && !listenIn.busy.value) {
      void listenIn.enableListenIn();
    }
  },
  { immediate: true },
);

async function copyCurrentRoundTitle() {
  if (!currentRound.value?.answer_label) return;
  const copied = await copyToClipboard(currentRound.value.answer_label);
  if (!copied) {
    toast.error($t("music_quiz.copy_music_name_failed"));
  }
}

async function handleJoin(name: string) {
  await player.join(name);
}

async function handleAnswer(suggestionId: string) {
  await player.answer(suggestionId);
}

async function handleReady() {
  await player.ready();
}

async function handleListenInToggle(enabled: boolean) {
  if (enabled) {
    await listenIn.enableListenIn();
  } else {
    await listenIn.disableListenIn();
  }
}

onBeforeUnmount(() => {
  clocks.teardown();
});
</script>

<style scoped>
.music-quiz-player {
  width: 100%;
  min-height: 100dvh;
  margin: 0 auto;
  padding: calc(0.75rem + env(safe-area-inset-top, 0px))
    calc(0.75rem + env(safe-area-inset-right, 0px))
    calc(1rem + env(safe-area-inset-bottom, 0px))
    calc(0.75rem + env(safe-area-inset-left, 0px));
}

.quiz-shell {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.quiz-shell--join,
.quiz-shell--game {
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  background: hsl(var(--card));
  padding: 0.9rem;
}

.quiz-shell__intro h1 {
  margin: 0;
  font-size: 1.55rem;
}

.quiz-shell__intro p {
  margin: 0.3rem 0 0;
  color: hsl(var(--muted-foreground));
}

.quiz-shell__stats {
  margin-top: 0.65rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.quiz-shell__stats span {
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
  background: hsl(var(--muted));
  padding: 0.2rem 0.6rem;
  font-size: 0.82rem;
}

.quiz-shell__listen-in {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--muted));
  padding: 0.6rem 0.75rem;
}

.quiz-shell__listen-in-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.2rem;
}

.quiz-shell__listen-in-copy small {
  color: hsl(var(--muted-foreground));
  font-size: 0.78rem;
}

.quiz-shell__section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.quiz-shell__title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
}

.quiz-shell__hint {
  margin: 0;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.quiz-shell__countdown {
  margin: 0;
  font-size: clamp(2rem, 11vw, 3rem);
  line-height: 1;
  text-align: center;
  font-weight: 800;
}

.quiz-shell__answers :deep(.quiz-answers) {
  gap: 0.7rem;
  border-radius: 10px;
}

.quiz-shell__answers :deep(.quiz-answers__button) {
  min-height: 4.3rem;
  justify-content: center;
  font-size: 1.05rem;
  text-align: center;
  font-weight: 700;
}

.quiz-shell__answer-result {
  margin: 0;
  text-align: center;
  font-weight: 700;
}

.quiz-shell__answer-result span {
  margin-left: 0.35rem;
}

.quiz-shell__answer-result--correct {
  color: hsl(142 76% 36%);
}

.quiz-shell__answer-result--incorrect {
  color: hsl(0 72% 51%);
}

@media (min-width: 768px) {
  .music-quiz-player {
    padding: 1.25rem;
  }

  .quiz-shell--join,
  .quiz-shell--game {
    padding: 1rem;
  }
}
</style>
