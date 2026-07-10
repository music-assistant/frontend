<template>
  <div class="music-quiz-player mx-auto flex w-full max-w-3xl flex-col gap-3">
    <Card v-if="gameRemoved">
      <CardContent>
        <p class="text-muted-foreground text-center">
          {{ $t("providers.music_quiz.game_no_longer_available") }}
        </p>
      </CardContent>
    </Card>

    <Card v-else-if="!playerId && !loading">
      <CardHeader class="items-center text-center">
        <span
          class="bg-primary/10 text-primary mb-1 grid size-14 place-items-center rounded-full"
        >
          <PartyPopper class="size-7" />
        </span>
        <CardTitle class="text-2xl">
          {{ info?.name || $t("providers.music_quiz.title") }}
        </CardTitle>
        <div v-if="info" class="flex flex-wrap justify-center gap-2 pt-1">
          <Badge variant="secondary">
            {{ $t("providers.music_quiz.players_count", [info.player_count]) }}
          </Badge>
          <Badge variant="secondary">
            {{ $t("providers.music_quiz.rounds_count", [info.round_count]) }}
          </Badge>
          <Badge variant="secondary">{{ modeLabel }}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <MusicQuizJoinForm
          :session-name="info?.name || $t('providers.music_quiz.title')"
          :busy="busy"
          @join="handleJoin"
        />
      </CardContent>
    </Card>

    <template v-else-if="state">
      <MusicQuizConnectionBanners :degraded="isConnectionDegraded" />

      <MusicQuizPlayerHeader
        :player-name="state.you.name"
        :rank="playerRank"
        :round-progress="roundProgress"
        :round-fraction="roundFraction"
        :score="state.you.score"
        :score-delta="playerRoundScoreLabel"
        :phase-label="phaseText"
      />

      <ListenIn
        domain="music_quiz"
        :mode="mode"
        :labels="listenInLabels"
        :recheck-events="listenInRecheckEvents"
        :get-error-message="getMusicQuizErrorMessage"
      />

      <MusicQuizPlayerStage
        :state="state"
        :current-round="currentRound"
        :busy="busy"
        :leaderboard-rows="leaderboardRows"
        :answered-count="answeredCount"
        :answer-remaining-label="answerRemainingLabel"
        :answer-remaining-fraction="answerRemainingFraction"
        :winner-text="winnerText"
        :ready-label="readyLabel"
        :current-round-image-url="currentRoundImageUrl"
        :lyrics-position="lyricsPosition"
        @answer="handleAnswer"
        @ready="handleReady"
        @copy-title="copyCurrentRoundTitle"
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
import MusicQuizJoinForm from "@/components/music-quiz/MusicQuizJoinForm.vue";
import { type MusicQuizLeaderboardRow } from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import MusicQuizPlayerHeader from "@/components/music-quiz/MusicQuizPlayerHeader.vue";
import MusicQuizPlayerStage from "@/components/music-quiz/MusicQuizPlayerStage.vue";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMusicQuizCelebration } from "@/composables/useMusicQuizCelebration";
import { useMusicQuizPlayer } from "@/composables/useMusicQuizPlayer";
import { useMusicQuizRoundClocks } from "@/composables/useMusicQuizRoundClocks";
import {
  getMusicQuizErrorMessage,
  getMusicQuizRoundScoreLabel,
  getMusicQuizWinnerText,
  rankMusicQuizPlayers,
} from "@/helpers/music_quiz";
import { copyToClipboard, getMediaImageUrl } from "@/helpers/utils";
import api, { ConnectionState } from "@/plugins/api";
import { EventType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { PartyPopper } from "@lucide/vue";
import { computed, onBeforeUnmount, watch } from "vue";
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
const { answerRemainingLabel, answerRemainingFraction, lyricsPosition } =
  clocks;

const { celebrate } = useMusicQuizCelebration();

const mode = computed(() => state.value?.mode ?? info.value?.mode);
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
  state.value ? rankMusicQuizPlayers(state.value.players) : [],
);

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
  const label = $t("providers.music_quiz.round_label");
  if (!currentRound.value) {
    return `${label} ${state.value.round_count}/${state.value.round_count}`;
  }
  return `${label} ${currentRound.value.round_index + 1}/${state.value.round_count}`;
});

const roundFraction = computed(() => {
  const currentState = state.value;
  if (!currentState || currentState.round_count <= 0) return 0;
  if (!currentRound.value) return 100;
  return (
    ((currentRound.value.round_index + 1) / currentState.round_count) * 100
  );
});

const playerRoundScoreLabel = computed(() =>
  state.value
    ? getMusicQuizRoundScoreLabel(state.value, state.value.you.name)
    : "",
);

const readyLabel = computed(() =>
  state.value?.you.ready
    ? $t("providers.music_quiz.waiting_for_next")
    : $t("providers.music_quiz.ready"),
);

const phaseText = computed(() => {
  if (!state.value) return "";
  if (state.value.phase === "lobby")
    return $t("providers.music_quiz.phase_waiting_for_players");
  if (state.value.phase === "answering")
    return $t("providers.music_quiz.phase_answers_open");
  if (state.value.phase === "reveal")
    return $t("providers.music_quiz.phase_enjoy_track");
  return $t("providers.music_quiz.phase_finished");
});

const currentRoundImageUrl = computed(() =>
  getMediaImageUrl(currentRound.value?.image_url ?? ""),
);

const isConnectionDegraded = computed(
  () =>
    api.state.value === ConnectionState.RECONNECTING ||
    api.state.value === ConnectionState.DISCONNECTED,
);

watch(
  () => state.value?.phase,
  (phase) => {
    if (phase === "finished") void celebrate();
  },
);

async function copyCurrentRoundTitle() {
  if (!currentRound.value?.answer_label) return;
  const copied = await copyToClipboard(currentRound.value.answer_label);
  if (!copied) {
    toast.error($t("providers.music_quiz.copy_music_name_failed"));
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

onBeforeUnmount(() => {
  clocks.teardown();
});
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
