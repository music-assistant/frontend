<template>
  <div class="music-quiz-player mx-auto flex w-full max-w-3xl flex-col gap-3">
    <Card v-if="gameRemoved" role="status">
      <CardHeader class="items-center text-center">
        <CircleStop class="text-muted-foreground size-10" aria-hidden="true" />
        <CardTitle>{{ $t("providers.music_quiz.game_ended") }}</CardTitle>
        <CardDescription>
          {{ $t("providers.music_quiz.game_ended_detail") }}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p class="text-muted-foreground text-center text-sm">
          {{ $t("providers.music_quiz.game_ended_wait") }}
        </p>
      </CardContent>
    </Card>

    <MusicQuizUnsupportedGame v-else-if="unsupportedGame" />

    <template
      v-else-if="activeInfo && !playerId && !loading && resolvedDefinition"
    >
      <MusicQuizSessionHeader
        :game="resolvedDefinition.game"
        :name="activeInfo.name"
        :phase-label="infoPhaseText"
        :round-label="
          $t('providers.music_quiz.rounds_count', [activeInfo.round_count])
        "
        :mode="activeInfo.mode"
      />
      <Card>
        <CardContent>
          <MusicQuizJoinForm
            :session-name="activeInfo?.name || $t('providers.music_quiz.title')"
            :busy="busy"
            :initial-name="rememberedName"
            @join="handleJoin"
          />
        </CardContent>
      </Card>
    </template>

    <template v-else-if="activeState && resolvedDefinition">
      <MusicQuizConnectionBanners :degraded="isConnectionDegraded" />

      <MusicQuizSessionHeader
        :game="resolvedDefinition.game"
        :name="activeState.name"
        :phase-label="phaseText"
        :round-label="roundProgress"
        :mode="activeState.mode"
      />

      <MusicQuizPlayerHeader
        :player-name="activeState.you.name"
        :rank="playerRank"
        :score="activeState.you.score"
        :score-delta="playerRoundScoreLabel"
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

    <Card v-else-if="loading">
      <CardContent>
        <p class="text-muted-foreground text-center">
          {{ $t("providers.music_quiz.loading") }}
        </p>
      </CardContent>
    </Card>

    <Card v-else role="status">
      <CardHeader class="items-center text-center">
        <Clock3 class="text-muted-foreground size-10" aria-hidden="true" />
        <CardTitle>{{ $t("guest.no_quiz_title") }}</CardTitle>
        <CardDescription>{{ $t("guest.no_quiz_description") }}</CardDescription>
      </CardHeader>
    </Card>
  </div>
</template>

<script setup lang="ts">
import ListenIn, { type ListenInLabels } from "@/components/ListenIn.vue";
import MusicQuizConnectionBanners from "@/components/music-quiz/MusicQuizConnectionBanners.vue";
import {
  getMusicQuizPhaseLabelKey,
  resolveMusicQuizDefinition,
} from "@/components/music-quiz/game_types";
import MusicQuizJoinForm from "@/components/music-quiz/MusicQuizJoinForm.vue";
import { type MusicQuizLeaderboardRow } from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import MusicQuizPlayerHeader from "@/components/music-quiz/MusicQuizPlayerHeader.vue";
import MusicQuizPlayerStage from "@/components/music-quiz/MusicQuizPlayerStage.vue";
import MusicQuizSessionHeader from "@/components/music-quiz/MusicQuizSessionHeader.vue";
import MusicQuizUnsupportedGame from "@/components/music-quiz/MusicQuizUnsupportedGame.vue";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { CircleStop, Clock3 } from "@lucide/vue";
import { computed, watch } from "vue";
import { toast } from "vue-sonner";

const player = useMusicQuizPlayer({
  notifyError: (message) => toast.error(message),
});

const {
  info,
  state,
  playerId,
  rememberedName,
  gameRemoved,
  busy,
  loading,
  currentRound,
} = player;

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
  const currentState = activeState.value;
  if (!currentState || currentState.phase === "lobby") return "";
  const label = $t("providers.music_quiz.round_label");
  if (!currentRound.value) {
    return `${label} ${currentState.round_count}/${currentState.round_count}`;
  }
  return `${label} ${currentRound.value.round_index + 1}/${currentState.round_count}`;
});

const playerRoundScoreLabel = computed(() =>
  activeState.value
    ? getMusicQuizRoundScoreLabel(activeState.value, activeState.value.you.name)
    : "",
);

const phaseText = computed(() => {
  const currentState = activeState.value;
  const definition = resolvedDefinition.value;
  return currentState && definition
    ? $t(getMusicQuizPhaseLabelKey(definition.game, currentState.phase))
    : "";
});
const infoPhaseText = computed(() => {
  const currentInfo = activeInfo.value;
  const definition = resolvedDefinition.value;
  return currentInfo && definition
    ? $t(getMusicQuizPhaseLabelKey(definition.game, currentInfo.phase))
    : "";
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
  min-height: 100%;
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
