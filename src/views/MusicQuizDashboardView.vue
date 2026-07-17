<template>
  <div
    ref="presentRootRef"
    data-testid="music-quiz-dashboard-root"
    :class="
      presentMode
        ? 'w-full lg:h-full lg:min-h-0 lg:overflow-hidden'
        : 'mx-auto w-full max-w-6xl p-4 sm:p-5'
    "
  >
    <MusicQuizPresentStage
      v-if="presentMode && activeState && resolvedDefinition"
      :state="activeState"
      :game="resolvedDefinition.game"
      :current-round="currentRound"
      :leaderboard-rows="leaderboardRows"
      :winner-text="winnerText"
      :phase-label="phaseLabel"
      :round-label="roundLabel"
      :join-link="joinLink"
      :is-connection-degraded="isConnectionDegraded"
      :listen-in-enabled="listenInEnabled"
      :game-component="resolvedDefinition.game.adapters.present"
      :answer-component="resolvedDefinition.answer.adapters.present"
      @exit="exitPresentMode"
    />

    <section v-else class="flex flex-col gap-4">
      <header class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-2xl font-bold">
            {{ $t("providers.music_quiz.title") }}
          </h1>
          <p v-if="!activeState" class="text-muted-foreground mt-1">
            {{ statusText }}
          </p>
        </div>
        <Button
          v-if="isAdmin && musicQuizProviderInstanceId"
          class="shrink-0"
          variant="ghost"
          size="icon"
          data-testid="music-quiz-settings"
          :aria-label="$t('providers.music_quiz.settings')"
          :title="$t('providers.music_quiz.settings')"
          @click="goToMusicQuizSettings"
        >
          <Settings class="size-5" />
        </Button>
      </header>

      <MusicQuizConnectionBanners :degraded="isConnectionDegraded" />

      <Card v-if="!state && !loading" class="mx-auto w-full max-w-xl">
        <CardContent
          class="flex flex-col items-center gap-4 px-5 py-8 text-center sm:px-8"
        >
          <span
            class="bg-primary/10 text-primary grid size-14 place-items-center rounded-full"
          >
            <PartyPopper class="size-7" />
          </span>
          <div class="flex flex-col gap-1">
            <h2 class="text-xl font-bold">
              {{ $t("providers.music_quiz.no_active_game") }}
            </h2>
            <p class="text-muted-foreground">
              {{ $t("providers.music_quiz.create_intro") }}
            </p>
          </div>
          <Button
            size="lg"
            data-testid="new-game-empty"
            @click="openSetupDialog"
          >
            <Plus class="size-4" />
            {{ $t("providers.music_quiz.new_game") }}
          </Button>
        </CardContent>
      </Card>

      <MusicQuizUnsupportedGame
        v-else-if="state && !activeState"
        :busy="busy"
        :can-end-game="true"
        @end-game="showEndGameDialog = true"
      />

      <MusicQuizPreparingState
        v-else-if="starting && activeState"
        class="rounded-xl border shadow-sm"
      />

      <div
        v-else-if="activeState && resolvedDefinition"
        class="flex flex-col gap-4"
      >
        <MusicQuizSessionHeader
          :game="resolvedDefinition.game"
          :name="activeState.name"
          :phase-label="phaseLabel"
          :round-label="roundLabel"
          :mode="activeState.mode"
          :listen-in-enabled="listenInEnabled"
        >
          <template #actions>
            <div class="flex items-center gap-2">
              <CastDashboardButton
                path="/music-quiz"
                variant="outline"
                button-size="icon"
                :icon-size="16"
              />
              <Button
                variant="outline"
                size="sm"
                data-testid="music-quiz-play-along"
                @click="playAlong"
              >
                <Gamepad2 class="size-4" aria-hidden="true" />
                {{ $t("providers.music_quiz.play_along") }}
              </Button>
            </div>
          </template>
        </MusicQuizSessionHeader>

        <MusicQuizHostPanel
          :state="activeState"
          :busy="busy"
          :join-link="joinLink"
          :is-last-round="!!isLastRound"
          :reveal-countdown="resolvedDefinition.game.usesRevealCountdown"
          @end-game="showEndGameDialog = true"
          @present="enterPresentMode"
          @start="host.start"
          @reveal="host.reveal"
          @next="host.next"
          @reset="handleReplay"
          @set-up-new-game="handleSetUpNewGame"
        >
          <template #game>
            <component
              :is="resolvedDefinition.game.adapters.hostPanel"
              :state="activeState"
              :current-round="currentRound"
            />
          </template>
        </MusicQuizHostPanel>

        <template v-if="isActiveRound && currentRound">
          <component
            :is="resolvedDefinition.game.adapters.host"
            :state="activeState"
            :current-round="currentRound"
          />
          <component
            :is="resolvedDefinition.answer.adapters.host"
            :state="activeState"
            :current-round="currentRound"
          >
            <template #leaderboard>
              <MusicQuizLeaderboard
                :rows="leaderboardRows"
                :title="$t('players')"
              />
            </template>
          </component>
        </template>

        <MusicQuizSessionPanels v-else :state="activeState" />
      </div>
    </section>

    <Dialog v-model:open="showSetupDialog">
      <DialogContent
        data-testid="setup-dialog"
        class="max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:max-w-[calc(100%-2rem)] sm:p-6 lg:max-w-3xl"
      >
        <DialogHeader class="pr-8 text-left">
          <DialogTitle>{{ $t("providers.music_quiz.new_game") }}</DialogTitle>
          <DialogDescription>
            {{ $t("providers.music_quiz.create_intro") }}
          </DialogDescription>
        </DialogHeader>
        <MusicQuizSetupWizard
          v-if="showSetupDialog"
          v-model:playback-selection="playbackSelection"
          :busy="busy"
          :available-quiz-types="availableQuizTypes"
          :playback-options="playbackOptions"
          :playback-options-loading="playbackOptionsLoading"
          :playback-options-legacy="playbackOptionsLegacy"
          :playback-options-error="playbackOptionsError"
          @create="handleCreate"
          @retry-playback-options="host.fetchPlaybackOptions"
        />
      </DialogContent>
    </Dialog>

    <MusicQuizEndGameDialog
      v-model="showEndGameDialog"
      :busy="busy"
      @confirm="confirmEndGame"
    />
  </div>
</template>

<script setup lang="ts">
import CastDashboardButton from "@/components/CastDashboardButton.vue";
import MusicQuizConnectionBanners from "@/components/music-quiz/MusicQuizConnectionBanners.vue";
import MusicQuizEndGameDialog from "@/components/music-quiz/MusicQuizEndGameDialog.vue";
import {
  getMusicQuizPhaseLabelKey,
  resolveMusicQuizDefinition,
  supportsMusicQuizListenIn,
} from "@/components/music-quiz/game_types";
import MusicQuizHostPanel from "@/components/music-quiz/MusicQuizHostPanel.vue";
import MusicQuizLeaderboard, {
  type MusicQuizLeaderboardRow,
} from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import MusicQuizPresentStage from "@/components/music-quiz/MusicQuizPresentStage.vue";
import MusicQuizPreparingState from "@/components/music-quiz/MusicQuizPreparingState.vue";
import MusicQuizSessionHeader from "@/components/music-quiz/MusicQuizSessionHeader.vue";
import MusicQuizSessionPanels from "@/components/music-quiz/MusicQuizSessionPanels.vue";
import MusicQuizSetupWizard from "@/components/music-quiz/MusicQuizSetupWizard.vue";
import MusicQuizUnsupportedGame from "@/components/music-quiz/MusicQuizUnsupportedGame.vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  isSupportedMusicQuiz,
  type MusicQuizCreateRequest,
} from "@/composables/useMusicQuiz";
import { useMusicQuizHost } from "@/composables/useMusicQuizHost";
import {
  getMusicQuizRoundScoreLabel,
  getMusicQuizWinnerText,
  rankMusicQuizPlayers,
} from "@/helpers/music_quiz";
import type { MusicQuizPlaybackSelection } from "@/helpers/music_quiz_playback";
import api, { ConnectionState } from "@/plugins/api";
import { ProviderType } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { Gamepad2, PartyPopper, Plus, Settings } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";

const router = useRouter();
const host = useMusicQuizHost({
  notifyError: (message) => toast.error(message),
});

const {
  state,
  busy,
  starting,
  loading,
  availableQuizTypes,
  playbackOptions,
  playbackOptionsLoading,
  playbackOptionsLegacy,
  playbackOptionsError,
  currentRound,
  isLastRound,
  joinLink,
} = host;

const resolvedDefinition = computed(() => {
  const currentState = state.value;
  return currentState
    ? resolveMusicQuizDefinition(
        currentState.quiz_type,
        currentState.answer_type,
      )
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
const listenInEnabled = computed(() => {
  const definition = resolvedDefinition.value;
  const currentState = activeState.value;
  return !!(
    definition &&
    currentState &&
    supportsMusicQuizListenIn(definition.game, currentState)
  );
});

const rankedPlayers = computed(() =>
  activeState.value ? rankMusicQuizPlayers(activeState.value.players) : [],
);

const leaderboardRows = computed<MusicQuizLeaderboardRow[]>(() => {
  const currentState = activeState.value;
  if (!currentState) return [];
  return rankedPlayers.value.map((player) => ({
    ...player,
    roundScoreLabel: getMusicQuizRoundScoreLabel(currentState, player.name),
  }));
});

const winnerText = computed(() => getMusicQuizWinnerText(rankedPlayers.value));

const phaseLabel = computed(() => {
  const currentState = activeState.value;
  const definition = resolvedDefinition.value;
  return currentState && definition
    ? $t(getMusicQuizPhaseLabelKey(definition.game, currentState.phase))
    : "";
});

const roundLabel = computed(() => {
  if (!activeState.value || !currentRound.value) return "";
  return `${$t("providers.music_quiz.round_label")} ${currentRound.value.round_index + 1} / ${activeState.value.round_count}`;
});

const statusText = computed(() => {
  if (loading.value) return $t("providers.music_quiz.loading");
  if (activeState.value) return phaseLabel.value;
  if (state.value) return $t("providers.music_quiz.unsupported_title");
  return $t("providers.music_quiz.no_active_game");
});

const isActiveRound = computed(
  () =>
    activeState.value?.phase === "answering" ||
    activeState.value?.phase === "reveal",
);

const isConnectionDegraded = computed(
  () =>
    api.state.value === ConnectionState.RECONNECTING ||
    api.state.value === ConnectionState.DISCONNECTED,
);

const presentMode = ref(false);
const presentRootRef = ref<HTMLElement | null>(null);
const showEndGameDialog = ref(false);
const showSetupDialog = ref(false);
const playbackSelection = ref<MusicQuizPlaybackSelection>({
  mode: null,
  venuePlayerId: null,
});
const musicQuizProviderInstanceId = ref<string | null>(null);
const isAdmin = computed(() => authManager.isAdmin());

watch(
  isAdmin,
  (admin) => {
    if (admin && !musicQuizProviderInstanceId.value) {
      void resolveMusicQuizProviderInstance();
    }
  },
  { immediate: true },
);

function openSetupDialog() {
  void host.fetchPlaybackOptions();
  showSetupDialog.value = true;
}

function goToMusicQuizSettings() {
  if (!musicQuizProviderInstanceId.value) return;
  void router.push({
    name: "editprovider",
    params: { instanceId: musicQuizProviderInstanceId.value },
  });
}

function playAlong() {
  void router.push({ name: "guest-quiz" });
}

async function handleCreate(request: MusicQuizCreateRequest) {
  if (await host.create(request)) showSetupDialog.value = false;
}

async function handleReplay() {
  if (busy.value) return;
  await host.replay();
}

async function handleSetUpNewGame() {
  if (busy.value) return;
  if (await host.deleteGame()) openSetupDialog();
}

async function enterPresentMode() {
  presentMode.value = true;
  if (!document.fullscreenElement) {
    const target = presentRootRef.value ?? document.documentElement;
    try {
      await target.requestFullscreen();
    } catch {
      // Keep present mode active even if fullscreen is blocked.
    }
  }
}

async function exitPresentMode() {
  presentMode.value = false;
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch {
      // Ignore fullscreen exit errors.
    }
  }
}

function onFullscreenChange() {
  if (!document.fullscreenElement) {
    presentMode.value = false;
  }
}

watch(state, (nextState) => {
  if (nextState) showSetupDialog.value = false;
  if (!nextState && presentMode.value) {
    void exitPresentMode();
  }
});

async function confirmEndGame() {
  await host.deleteGame();
}

onMounted(() => {
  document.addEventListener("fullscreenchange", onFullscreenChange);
});

onBeforeUnmount(() => {
  document.removeEventListener("fullscreenchange", onFullscreenChange);
});

async function resolveMusicQuizProviderInstance() {
  try {
    const configs = await api.getProviderConfigs(
      ProviderType.PLUGIN,
      "music_quiz",
    );
    musicQuizProviderInstanceId.value = configs[0]?.instance_id ?? null;
  } catch (error) {
    musicQuizProviderInstanceId.value = null;
    console.error("Failed to load Music Quiz settings:", error);
  }
}
</script>
