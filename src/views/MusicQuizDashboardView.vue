<template>
  <div
    ref="presentRootRef"
    data-testid="music-quiz-dashboard-root"
    :class="[
      presentMode
        ? 'w-full lg:h-full lg:min-h-0 lg:overflow-hidden'
        : 'mx-auto flex min-h-full w-full max-w-6xl flex-col p-4 sm:p-5',
    ]"
  >
    <MusicQuizPresentStage
      v-if="presentMode && activeState && resolvedDefinition"
      :state="activeState"
      :game="resolvedDefinition.game"
      :current-round="currentRound"
      :leaderboard-rows="leaderboardRows"
      :phase-label="phaseLabel"
      :round-label="roundLabel"
      :join-link="joinLink"
      :is-connection-degraded="isConnectionDegraded"
      :listen-in-enabled="listenInEnabled"
      :game-component="resolvedDefinition.game.adapters.present"
      :answer-component="resolvedDefinition.answer.adapters.present"
      :round-fastest="roundFastest"
      :awards="awards"
      @exit="exitPresentMode"
    />

    <section v-else class="flex flex-1 flex-col gap-4">
      <header class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-2xl font-bold">
            {{ $t("providers.music_quiz.title") }}
          </h1>
          <p v-if="!activeState" class="text-muted-foreground mt-1">
            {{ statusText }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <Button
            v-if="
              showGameSettings ||
              (canConfigureMusicQuiz && musicQuizProviderInstanceId)
            "
            variant="ghost"
            size="icon"
            data-testid="music-quiz-settings"
            :aria-label="settingsLabel"
            :title="settingsLabel"
            @click="openSettings"
          >
            <Settings class="size-5" />
          </Button>
          <ShowDashboardButton
            dashboard="music_quiz"
            variant="ghost"
            button-size="icon"
            :icon-size="20"
          />
        </div>
      </header>

      <MusicQuizConnectionBanners :degraded="isConnectionDegraded" />

      <div
        v-if="!state && !loading"
        class="flex flex-1 items-center justify-center"
      >
        <Empty
          class="bg-card w-full max-w-xl rounded-xl border border-solid px-5 py-10 shadow-sm sm:px-8"
        >
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
              class="bg-primary/10 text-primary size-14 rounded-full"
            >
              <MicVocal class="size-7" />
            </EmptyMedia>
            <EmptyTitle class="text-xl font-bold">
              {{ $t("providers.music_quiz.no_active_game") }}
            </EmptyTitle>
            <EmptyDescription class="text-base">
              {{ $t("providers.music_quiz.create_intro") }}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              size="lg"
              data-testid="new-game-empty"
              @click="openSetupDialog"
            >
              <Plus class="size-4" />
              {{ $t("providers.music_quiz.new_game") }}
            </Button>
          </EmptyContent>
        </Empty>
      </div>

      <MusicQuizUnsupportedGame
        v-else-if="state && !activeState"
        :busy="busy"
        :can-end-game="true"
        @end-game="showEndGameDialog = true"
      />

      <MusicQuizPreparingState
        v-else-if="isPreparing && activeState"
        :autofocus="starting"
        class="rounded-xl border shadow-sm"
      />

      <div
        v-else-if="activeState && resolvedDefinition"
        class="flex flex-col gap-4"
      >
        <MusicQuizSessionHeader
          :game="resolvedDefinition.game"
          :name="activeState.name"
          :phase-label="headerPhaseLabel"
          :round-label="roundLabel"
          :mode="activeState.mode"
          compact
          :live-status="phaseLabel"
          :subtitle="musicHeadline"
        >
          <template #actions>
            <Button
              variant="outline"
              size="sm"
              class="me-2"
              data-testid="music-quiz-invite"
              @click="showInviteDialog = true"
            >
              <QrCode class="size-4" aria-hidden="true" />
              {{ $t("providers.music_quiz.invite_players") }}
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="music-quiz-play-along"
              @click="playAlong"
            >
              <Gamepad2 class="size-4" aria-hidden="true" />
              {{ $t("providers.music_quiz.play_along") }}
            </Button>
          </template>
        </MusicQuizSessionHeader>

        <MusicQuizHostControlStrip
          :state="activeState"
          :current-round="currentRound"
          :busy="busy"
          :is-last-round="!!isLastRound"
          :reveal-countdown="resolvedDefinition.game.usesRevealCountdown"
          @end-game="showEndGameDialog = true"
          @present="enterPresentMode"
          @start="host.start"
          @reveal="host.reveal"
          @next="host.next"
          @reset="handleReplay"
          @set-up-new-game="handleSetUpNewGame"
        />

        <template v-if="isActiveRound && currentRound">
          <MusicQuizRoundFastest v-if="roundFastest" :fastest="roundFastest" />
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
                :show-ready="activeState.phase === 'reveal'"
              />
            </template>
          </component>
        </template>

        <template v-else-if="activeState.phase === 'finished'">
          <MusicQuizPodium
            v-if="leaderboardRows.length"
            :rows="leaderboardRows"
          />
          <MusicQuizGameAwards v-if="awards.length" :awards="awards" />
          <MusicQuizLeaderboard
            :rows="leaderboardRows"
            :title="$t('providers.music_quiz.final_leaderboard')"
          />
        </template>

        <template v-else>
          <MusicQuizSessionPanels :state="activeState" />
          <MusicQuizGameAwards v-if="awards.length" :awards="awards" />
        </template>
      </div>
    </section>

    <!-- Games with no music (Trivia without revealed songs) have nothing
         for the quiz bar to say. -->
    <MusicQuizPlayerBar
      v-if="!presentMode && activeState && listenInEnabled"
      :state="activeState"
    />

    <Dialog v-model:open="showSetupDialog">
      <DialogContent
        data-testid="setup-dialog"
        class="max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:max-w-[calc(100%-2rem)] sm:p-6 lg:max-w-3xl"
      >
        <DialogHeader class="sr-only">
          <DialogTitle>{{ $t("providers.music_quiz.new_game") }}</DialogTitle>
          <DialogDescription>
            {{ $t("providers.music_quiz.create_intro") }}
          </DialogDescription>
        </DialogHeader>
        <MusicQuizSteppedSetup
          v-if="showSetupDialog"
          v-model:playback-selection="playbackSelection"
          :busy="busy"
          :available-quiz-types="availableQuizTypes"
          :playback-options="playbackOptions"
          :playback-options-loading="playbackOptionsLoading"
          :playback-options-error="playbackOptionsError"
          @create="handleCreate"
          @retry-playback-options="host.fetchPlaybackOptions"
        />
      </DialogContent>
    </Dialog>

    <MusicQuizGameSettingsSheet
      v-if="activeState && resolvedDefinition"
      v-model:open="showGameSettingsSheet"
      :state="activeState"
      :game="resolvedDefinition.game"
      :show-plugin-settings="
        canConfigureMusicQuiz && !!musicQuizProviderInstanceId
      "
      @plugin-settings="goToMusicQuizSettings"
    />

    <Dialog v-model:open="showInviteDialog">
      <DialogContent data-testid="invite-dialog" class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{{
            $t("providers.music_quiz.invite_players")
          }}</DialogTitle>
          <DialogDescription class="sr-only">
            {{ $t("providers.music_quiz.invite_players") }}
          </DialogDescription>
        </DialogHeader>
        <MusicQuizQrCard :join-link="joinLink" />
        <DialogFooter>
          <Button class="w-full" @click="showInviteDialog = false">
            {{ $t("close") }}
          </Button>
        </DialogFooter>
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
import {
  getMusicQuizPhaseLabelKey,
  resolveMusicQuizDefinition,
  supportsMusicQuizListenIn,
} from "@/components/music-quiz/game_types";
import MusicQuizConnectionBanners from "@/components/music-quiz/MusicQuizConnectionBanners.vue";
import MusicQuizEndGameDialog from "@/components/music-quiz/MusicQuizEndGameDialog.vue";
import MusicQuizLeaderboard, {
  type MusicQuizLeaderboardRow,
} from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import MusicQuizPreparingState from "@/components/music-quiz/MusicQuizPreparingState.vue";
import MusicQuizGameAwards from "@/components/music-quiz/MusicQuizGameAwards.vue";
import MusicQuizGameSettingsSheet from "@/components/music-quiz/MusicQuizGameSettingsSheet.vue";
import MusicQuizHostControlStrip from "@/components/music-quiz/MusicQuizHostControlStrip.vue";
import MusicQuizPlayerBar from "@/components/music-quiz/MusicQuizPlayerBar.vue";
import MusicQuizPodium from "@/components/music-quiz/MusicQuizPodium.vue";
import MusicQuizPresentStage from "@/components/music-quiz/MusicQuizPresentStage.vue";
import MusicQuizQrCard from "@/components/music-quiz/MusicQuizQrCard.vue";
import MusicQuizRoundFastest from "@/components/music-quiz/MusicQuizRoundFastest.vue";
import MusicQuizSessionHeader from "@/components/music-quiz/MusicQuizSessionHeader.vue";
import MusicQuizSessionPanels from "@/components/music-quiz/MusicQuizSessionPanels.vue";
import MusicQuizSteppedSetup from "@/components/music-quiz/MusicQuizSteppedSetup.vue";
import MusicQuizUnsupportedGame from "@/components/music-quiz/MusicQuizUnsupportedGame.vue";
import ShowDashboardButton from "@/components/ShowDashboardButton.vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  isSupportedMusicQuiz,
  type MusicQuizCreateRequest,
} from "@/composables/music-quiz/useMusicQuiz";
import { useMusicQuizHost } from "@/composables/music-quiz/useMusicQuizHost";
import { useMusicQuizHostStats } from "@/composables/music-quiz/useMusicQuizHostStats";
import { getMusicQuizSourceHeadline } from "@/helpers/music_quiz_sources";
import {
  getMusicQuizRoundScoreLabel,
  rankMusicQuizPlayers,
} from "@/helpers/music_quiz";
import type { MusicQuizPlaybackSelection } from "@/helpers/music_quiz_playback";
import api, { ConnectionState } from "@/plugins/api";
import { ProviderType, Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { Gamepad2, MicVocal, Plus, QrCode, Settings } from "@lucide/vue";
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

const phaseLabel = computed(() => {
  const currentState = activeState.value;
  const definition = resolvedDefinition.value;
  return currentState && definition
    ? $t(getMusicQuizPhaseLabelKey(definition.game, currentState.phase))
    : "";
});

const musicHeadline = computed(() =>
  getMusicQuizSourceHeadline(activeState.value?.sources ?? []),
);

// With a game running, Settings shows that game's settings (with the plugin
// settings one tap further); without one, it goes to the plugin settings.
const showGameSettingsSheet = ref(false);
const showGameSettings = computed(() => !!activeState.value);
const settingsLabel = computed(() =>
  showGameSettings.value
    ? $t("providers.music_quiz.game_settings_title")
    : $t("providers.music_quiz.settings"),
);
function openSettings() {
  if (showGameSettings.value) {
    showGameSettingsSheet.value = true;
  } else {
    goToMusicQuizSettings();
  }
}
const { roundFastest, awards } = useMusicQuizHostStats(activeState);

// The invite popup opens by itself once per game, when it reaches the lobby.
// Remembered across navigation and reloads, so coming back doesn't reopen it.
const INVITE_SHOWN_KEY = "music-quiz-invite-shown";
const showInviteDialog = ref(false);
function inviteShownFor(createdAt: number): boolean {
  try {
    return localStorage.getItem(INVITE_SHOWN_KEY) === String(createdAt);
  } catch {
    return false;
  }
}
function rememberInviteShown(createdAt: number): void {
  try {
    localStorage.setItem(INVITE_SHOWN_KEY, String(createdAt));
  } catch {
    // Without storage it may open once more after a reload.
  }
}
watch(
  () => [activeState.value?.created_at, activeState.value?.phase] as const,
  ([createdAt, phase]) => {
    if (phase !== "lobby" || createdAt == null) return;
    if (inviteShownFor(createdAt)) return;
    rememberInviteShown(createdAt);
    showInviteDialog.value = true;
  },
  { immediate: true },
);
// The auto-opened popup shouldn't sit over a round that has started.
watch(
  () => activeState.value?.phase,
  (phase, previous) => {
    if (previous === "lobby" && phase !== "lobby")
      showInviteDialog.value = false;
  },
);
// The compact header only keeps the lobby's "Waiting for players" status.
const headerPhaseLabel = computed(() =>
  activeState.value?.phase !== "lobby" ? "" : phaseLabel.value,
);

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

// The local flag covers the gap between issuing a host action and the server
// reporting that round preparation is underway.
const isPreparing = computed(
  () => starting.value || activeState.value?.preparing === true,
);

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
// the settings shortcut opens the plugin config, which takes managing every provider
const canConfigureMusicQuiz = computed(() =>
  authManager.hasScope(Scope.CONFIG_PROVIDERS_WRITE),
);

watch(
  canConfigureMusicQuiz,
  (canConfigure) => {
    if (canConfigure && !musicQuizProviderInstanceId.value) {
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
