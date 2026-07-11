<template>
  <div class="music-quiz-player mx-auto flex w-full max-w-3xl flex-col gap-3">
    <Card v-if="gameRemoved">
      <CardContent>
        <p class="text-muted-foreground text-center">
          {{ $t("providers.music_quiz.game_no_longer_available") }}
        </p>
      </CardContent>
    </Card>

    <MusicQuizUnsupportedGame v-else-if="unsupportedGame" />

    <Card v-else-if="!playerId && !loading">
      <CardHeader class="items-center text-center">
        <span
          class="bg-primary/10 text-primary mb-1 grid size-14 place-items-center rounded-full"
        >
          <PartyPopper class="size-7" />
        </span>
        <CardTitle class="text-2xl">
          {{ activeInfo?.name || $t("providers.music_quiz.title") }}
        </CardTitle>
        <div v-if="activeInfo" class="flex flex-wrap justify-center gap-2 pt-1">
          <Badge variant="secondary">
            {{
              $t("providers.music_quiz.players_count", [
                activeInfo.player_count,
              ])
            }}
          </Badge>
          <Badge variant="secondary">
            {{
              $t("providers.music_quiz.rounds_count", [activeInfo.round_count])
            }}
          </Badge>
          <Badge variant="secondary">{{ modeLabel }}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <MusicQuizJoinForm
          :session-name="activeInfo?.name || $t('providers.music_quiz.title')"
          :busy="busy"
          @join="handleJoin"
        />
      </CardContent>
    </Card>

    <template v-else-if="activeState && resolvedDefinition">
      <MusicQuizConnectionBanners :degraded="isConnectionDegraded" />

      <MusicQuizPlayerHeader
        :player-name="activeState.you.name"
        :rank="playerRank"
        :round-progress="roundProgress"
        :round-fraction="roundFraction"
        :score="activeState.you.score"
        :score-delta="playerRoundScoreLabel"
        :phase-label="phaseText"
      />

      <ListenIn
        v-if="resolvedDefinition.game.supportsListenIn"
        domain="music_quiz"
        :mode="mode"
        :labels="listenInLabels"
        :recheck-events="listenInRecheckEvents"
        :get-error-message="getMusicQuizErrorMessage"
      />

      <MusicQuizPlayerStage
        :state="activeState"
        :current-round="currentRound"
        :busy="busy"
        :leaderboard-rows="leaderboardRows"
        :winner-text="winnerText"
        :game-component="resolvedDefinition.game.adapters.player"
        :answer-component="resolvedDefinition.answer.adapters.player"
        @submit-answer="handleSubmitAnswer"
        @ready="handleReady"
      />
    </template>

    <Card v-else>
      <CardContent>
        <p class="text-muted-foreground text-center">
          {{ $t("providers.music_quiz.loading") }}
        </p>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import ListenIn, { type ListenInLabels } from "@/components/ListenIn.vue";
import MusicQuizConnectionBanners from "@/components/music-quiz/MusicQuizConnectionBanners.vue";
import { resolveMusicQuizDefinition } from "@/components/music-quiz/game_types";
import MusicQuizJoinForm from "@/components/music-quiz/MusicQuizJoinForm.vue";
import { type MusicQuizLeaderboardRow } from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import MusicQuizPlayerHeader from "@/components/music-quiz/MusicQuizPlayerHeader.vue";
import MusicQuizPlayerStage from "@/components/music-quiz/MusicQuizPlayerStage.vue";
import MusicQuizUnsupportedGame from "@/components/music-quiz/MusicQuizUnsupportedGame.vue";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMusicQuizCelebration } from "@/composables/useMusicQuizCelebration";
import { useMusicQuizPlayer } from "@/composables/useMusicQuizPlayer";
import {
  isSupportedMusicQuiz,
  type MusicQuizAnswerSubmission,
} from "@/composables/useMusicQuiz";
import {
  getMusicQuizErrorMessage,
  getMusicQuizRoundScoreLabel,
  getMusicQuizWinnerText,
  rankMusicQuizPlayers,
} from "@/helpers/music_quiz";
import api, { ConnectionState } from "@/plugins/api";
import { EventType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { PartyPopper } from "@lucide/vue";
import { computed, watch } from "vue";
import { toast } from "vue-sonner";

const player = useMusicQuizPlayer({
  notifyError: (message) => toast.error(message),
});

const { info, state, playerId, gameRemoved, busy, loading, currentRound } =
  player;

const resolvedDefinition = computed(() => {
  const activeGame = state.value ?? info.value;
  return activeGame
    ? resolveMusicQuizDefinition(activeGame.quiz_type, activeGame.answer_type)
    : undefined;
});
const activeState = computed(() => {
  const currentState = state.value;
  return currentState &&
    resolvedDefinition.value &&
    isSupportedMusicQuiz(currentState)
    ? currentState
    : null;
});
const activeInfo = computed(() => {
  const currentInfo = info.value;
  return currentInfo &&
    resolvedDefinition.value &&
    isSupportedMusicQuiz(currentInfo)
    ? currentInfo
    : null;
});
const unsupportedGame = computed(() => {
  const activeGame = state.value ?? info.value;
  return !!activeGame && !resolvedDefinition.value;
});

const { celebrate } = useMusicQuizCelebration();

const mode = computed(() => {
  if (activeState.value) return activeState.value.mode;
  return activeInfo.value?.mode;
});
const modeLabel = computed(() =>
  mode.value === "remote"
    ? $t("providers.music_quiz.mode_remote")
    : $t("providers.music_quiz.mode_venue"),
);

const listenInRecheckEvents = [EventType.PROVIDER_EVENT];
const listenInLabels = computed<ListenInLabels>(() => ({
  title: $t("providers.music_quiz.listen_in"),
  titleActive: $t("providers.music_quiz.listen_in_active"),
  descriptionVenue: $t("providers.music_quiz.listen_in_venue"),
  descriptionRemote: $t("providers.music_quiz.listen_in_remote"),
  tap: $t("providers.music_quiz.listen_in_tap"),
  stop: $t("providers.music_quiz.listen_in_stop"),
  poweredBy: $t("providers.music_quiz.listen_in_powered_by"),
  errorNoWebPlayer: $t("providers.music_quiz.error_no_web_player"),
  errorListenIn: $t("providers.music_quiz.error_listen_in"),
  errorStopListenIn: $t("providers.music_quiz.error_stop_listen_in"),
}));

const rankedPlayers = computed(() =>
  activeState.value ? rankMusicQuizPlayers(activeState.value.players) : [],
);

const playerRank = computed(() => {
  const currentState = activeState.value;
  if (!currentState) return null;
  return (
    rankedPlayers.value.find((row) => row.name === currentState.you.name)
      ?.rank ?? null
  );
});

const leaderboardRows = computed<MusicQuizLeaderboardRow[]>(() => {
  const currentState = activeState.value;
  if (!currentState) return [];
  return rankedPlayers.value.map((playerRow) => ({
    ...playerRow,
    roundScoreLabel: getMusicQuizRoundScoreLabel(currentState, playerRow.name),
  }));
});

const winnerText = computed(() => getMusicQuizWinnerText(rankedPlayers.value));

const roundProgress = computed(() => {
  if (!activeState.value) return "";
  const label = $t("providers.music_quiz.round_label");
  if (!currentRound.value) {
    return `${label} ${activeState.value.round_count}/${activeState.value.round_count}`;
  }
  return `${label} ${currentRound.value.round_index + 1}/${activeState.value.round_count}`;
});

const roundFraction = computed(() => {
  const currentState = activeState.value;
  if (!currentState || currentState.round_count <= 0) return 0;
  if (!currentRound.value) return 100;
  return (
    ((currentRound.value.round_index + 1) / currentState.round_count) * 100
  );
});

const playerRoundScoreLabel = computed(() =>
  activeState.value
    ? getMusicQuizRoundScoreLabel(activeState.value, activeState.value.you.name)
    : "",
);

const phaseText = computed(() => {
  if (!activeState.value) return "";
  if (activeState.value.phase === "lobby")
    return $t("providers.music_quiz.phase_waiting_for_players");
  if (activeState.value.phase === "answering")
    return $t("providers.music_quiz.phase_answers_open");
  if (activeState.value.phase === "reveal")
    return activeState.value.quiz_type === "trivia"
      ? $t("providers.music_quiz.phase_answer_revealed")
      : $t("providers.music_quiz.phase_enjoy_track");
  return $t("providers.music_quiz.phase_finished");
});

const isConnectionDegraded = computed(
  () =>
    api.state.value === ConnectionState.RECONNECTING ||
    api.state.value === ConnectionState.DISCONNECTED,
);

watch(
  () => activeState.value?.phase,
  (phase) => {
    if (phase === "finished") void celebrate();
  },
);

async function handleJoin(name: string) {
  await player.join(name);
}

async function handleSubmitAnswer(submission: MusicQuizAnswerSubmission) {
  await player.submitAnswer(submission);
}

async function handleReady() {
  await player.ready();
}
</script>

<style scoped>
.music-quiz-player {
  min-height: 100dvh;
  padding: calc(0.75rem + env(safe-area-inset-top, 0px))
    calc(0.75rem + env(safe-area-inset-right, 0px))
    calc(1rem + env(safe-area-inset-bottom, 0px))
    calc(0.75rem + env(safe-area-inset-left, 0px));
}

@media (min-width: 768px) {
  .music-quiz-player {
    padding: 1.25rem;
  }
}
</style>
