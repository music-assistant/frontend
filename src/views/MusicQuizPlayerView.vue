<template>
  <div class="music-quiz-player mx-auto flex w-full max-w-3xl flex-col gap-3">
    <MusicQuizListenControl
      v-if="listenInEnabled"
      ref="listenControlRef"
      :mode="mode"
      :labels="listenInLabels"
      :recheck-events="listenInRecheckEvents"
      :get-error-message="getMusicQuizErrorMessage"
    />
    <Card v-if="gameRemoved">
      <CardHeader class="justify-items-center text-center" role="status">
        <CircleStop class="text-muted-foreground size-10" aria-hidden="true" />
        <CardTitle>{{ $t("providers.music_quiz.game_ended") }}</CardTitle>
        <CardDescription>
          {{ $t("providers.music_quiz.game_ended_detail") }}
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col items-center gap-4">
        <p class="text-muted-foreground text-center text-sm">
          {{ $t("providers.music_quiz.game_ended_wait") }}
        </p>
        <Button
          v-if="canReturnToHostPanel"
          size="lg"
          data-testid="return-to-host-panel"
          @click="returnToHostPanel"
        >
          <ArrowLeft class="size-4" aria-hidden="true" />
          {{ $t("providers.music_quiz.return_to_host_panel") }}
        </Button>
      </CardContent>
    </Card>

    <MusicQuizUnsupportedGame v-else-if="unsupportedGame" />

    <template v-else-if="showLanding && resolvedDefinition">
      <!-- The game is named once, in this card. -->

      <Card>
        <CardContent class="flex flex-col items-center gap-2 text-center">
          <span
            class="bg-primary/10 text-primary grid size-16 place-items-center rounded-full"
          >
            <component
              :is="resolvedDefinition.game.icon"
              class="size-8"
              aria-hidden="true"
            />
          </span>
          <div>
            <p
              v-if="landingQuiz?.name"
              class="text-muted-foreground text-sm font-medium"
            >
              {{ $t(resolvedDefinition.game.labelKey) }}
            </p>
            <h2
              class="text-xl font-bold"
              data-testid="music-quiz-landing-title"
            >
              {{ landingQuiz?.name || $t(resolvedDefinition.game.labelKey) }}
            </h2>
            <p class="text-muted-foreground">
              {{ $t(resolvedDefinition.game.howToPlayDescriptionKey) }}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card v-if="!playerId && activeInfo">
        <CardContent>
          <MusicQuizAutoStartStatus
            :state="activeInfo"
            class="text-muted-foreground mb-4 text-center font-semibold"
          />
          <MusicQuizJoinForm
            :session-name="activeInfo?.name || $t('providers.music_quiz.title')"
            :busy="busy || listenInBusy"
            :initial-name="rememberedName"
            @join="handleJoin"
          />
        </CardContent>
      </Card>
      <Button
        v-else
        size="lg"
        class="w-full"
        data-testid="music-quiz-landing-continue"
        :disabled="listenInBusy"
        @click="handleContinue"
      >
        {{ $t("providers.music_quiz.landing_continue") }}
      </Button>
    </template>

    <template v-else-if="activeState && resolvedDefinition">
      <MusicQuizConnectionBanners :degraded="isConnectionDegraded" />

      <MusicQuizRoundResultBanner
        v-if="activeState.phase === 'reveal' && playedThisRound"
        :results="playerRoundResults"
        :answered="!!activeState.you.answer"
      />

      <MusicQuizPlayerStage
        :state="activeState"
        :current-round="currentRound"
        :busy="busy"
        :player-id="playerId"
        :leaderboard-rows="leaderboardRows"
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

    <Card v-else>
      <CardHeader class="justify-items-center text-center" role="status">
        <Clock3 class="text-muted-foreground size-10" aria-hidden="true" />
        <CardTitle>{{ $t("guest.no_quiz_title") }}</CardTitle>
        <CardDescription>{{ $t("guest.no_quiz_description") }}</CardDescription>
      </CardHeader>
      <CardContent v-if="canReturnToHostPanel" class="flex justify-center">
        <Button
          size="lg"
          data-testid="return-to-host-panel"
          @click="returnToHostPanel"
        >
          <ArrowLeft class="size-4" aria-hidden="true" />
          {{ $t("providers.music_quiz.return_to_host_panel") }}
        </Button>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import type { ListenInLabels } from "@/components/ListenIn.vue";
import MusicQuizAutoStartStatus from "@/components/music-quiz/MusicQuizAutoStartStatus.vue";
import MusicQuizConnectionBanners from "@/components/music-quiz/MusicQuizConnectionBanners.vue";
import {
  resolveMusicQuizDefinition,
  supportsMusicQuizListenIn,
} from "@/components/music-quiz/game_types";
import MusicQuizJoinForm from "@/components/music-quiz/MusicQuizJoinForm.vue";
import MusicQuizListenControl from "@/components/music-quiz/MusicQuizListenControl.vue";
import { type MusicQuizLeaderboardRow } from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import type { MusicQuizRoundResult } from "@/components/music-quiz/MusicQuizPlayerHeader.vue";
import MusicQuizPlayerStage from "@/components/music-quiz/MusicQuizPlayerStage.vue";
import MusicQuizRoundResultBanner from "@/components/music-quiz/MusicQuizRoundResultBanner.vue";
import MusicQuizUnsupportedGame from "@/components/music-quiz/MusicQuizUnsupportedGame.vue";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMusicQuizCelebration } from "@/composables/music-quiz/useMusicQuizCelebration";
import { useMusicQuizPlayer } from "@/composables/music-quiz/useMusicQuizPlayer";
import {
  isSupportedMusicQuiz,
  type MusicQuizAnswerSubmission,
} from "@/composables/music-quiz/useMusicQuiz";
import {
  getMusicQuizErrorMessage,
  getMusicQuizRoundScoreLabel,
  rankMusicQuizPlayers,
} from "@/helpers/music_quiz";
import api, { ConnectionState } from "@/plugins/api";
import { EventType } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { webPlayer } from "@/plugins/web_player";
import { ArrowLeft, CircleStop, Clock3 } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";

const router = useRouter();
const player = useMusicQuizPlayer({
  notifyError: (message) => toast.error(message),
});
const canReturnToHostPanel = !authManager.isGuestAccessSession();

const {
  info,
  state,
  playerId,
  rememberedName,
  gameRemoved,
  busy,
  loading,
  landingSeen,
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
const listenInEnabled = computed(() => {
  const definition = resolvedDefinition.value;
  const currentState = activeState.value ?? activeInfo.value;
  return !!(
    definition &&
    currentState &&
    supportsMusicQuizListenIn(definition.game, currentState)
  );
});
const unsupportedGame = computed(() => {
  const activeGame = state.value ?? info.value;
  return !!activeGame && !resolvedDefinition.value;
});

const showLanding = computed(
  () =>
    !!resolvedDefinition.value &&
    // `loading` is only raised by foreground loads (initial load and
    // `resetToJoinInfo`), never by event-driven background refreshes, so
    // gating on it shows the spinner instead of a stale previous-game landing
    // while a refetch is in flight, without remounting the join form (and
    // wiping the half-typed name) whenever another player joins.
    ((!!activeInfo.value && !playerId.value && !loading.value) ||
      (!!playerId.value && !!activeState.value && !landingSeen.value)),
);
const landingQuiz = computed(() => activeState.value ?? activeInfo.value);
const listenControlRef = ref<InstanceType<
  typeof MusicQuizListenControl
> | null>(null);
const listenInBusy = computed(() => listenControlRef.value?.busy ?? false);

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

const leaderboardRows = computed<MusicQuizLeaderboardRow[]>(() => {
  const currentState = activeState.value;
  if (!currentState) return [];
  return rankedPlayers.value.map((playerRow) => ({
    ...playerRow,
    roundScoreLabel: getMusicQuizRoundScoreLabel(currentState, playerRow.name),
  }));
});

// Someone who joined mid-round had no question to answer: no right/wrong panel.
const playedThisRound = computed(() => {
  const round = activeState.value?.current_round;
  const you = activeState.value?.you;
  return !!round && !!you && you.active_from_round <= round.round_index;
});

const playerRoundResults = computed<MusicQuizRoundResult[]>(() => {
  const currentState = activeState.value;
  if (!currentState || currentState.phase !== "reveal") return [];
  const answer = currentState.you.answer;
  if (!answer) return [];
  // "bonuses" is required on timeline answers, unlike the optional bonus_results
  if ("bonuses" in answer) {
    const results: MusicQuizRoundResult[] = [];
    if (answer.correct !== undefined) {
      results.push({
        key: "placement",
        label: $t("providers.music_quiz.timeline_result_placement"),
        correct: answer.correct,
        points: answer.points ?? 0,
      });
    }
    for (const bonus of answer.bonus_results ?? []) {
      results.push({
        key: bonus.bonus_type,
        label: $t(
          bonus.bonus_type === "artist"
            ? "providers.music_quiz.timeline_artist_bonus"
            : "providers.music_quiz.timeline_title_bonus",
        ),
        correct: bonus.correct,
        points: bonus.points,
      });
    }
    return results;
  }
  if (answer.correct === undefined) return [];
  return [
    {
      key: "answer",
      label: $t("providers.music_quiz.round_result_answer"),
      correct: answer.correct,
      points: answer.points ?? 0,
    },
  ];
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
  if (listenInEnabled.value) webPlayer.primeAudio();
  await player.join(name);
  // A join failure leaves no player_id, and the landing stays up to retry.
  if (!playerId.value) return;
  player.markLandingSeen();
  // Remote games ask whether to play the music on this phone.
  await listenControlRef.value?.askAfterJoin(playerId.value);
}

async function handleContinue() {
  webPlayer.primeAudio();
  player.markLandingSeen();
  if (playerId.value) {
    await listenControlRef.value?.askAfterJoin(playerId.value);
  }
}

async function handleSubmitAnswer(submission: MusicQuizAnswerSubmission) {
  await player.submitAnswer(submission);
}

async function handleReady() {
  await player.ready();
}

function returnToHostPanel() {
  void router.push({ name: "music-quiz" });
}
</script>

<style scoped>
.music-quiz-player {
  min-height: 100%;
  padding: 0.75rem 0.75rem 1rem;
}

@media (min-width: 768px) {
  .music-quiz-player {
    padding: 1.25rem;
  }
}
</style>
