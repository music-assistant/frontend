<template>
  <div ref="presentRootRef" class="mx-auto w-full max-w-6xl p-4 sm:p-5">
    <MusicQuizPresentStage
      v-if="presentMode && activeState && resolvedDefinition"
      :state="activeState"
      :current-round="currentRound"
      :leaderboard-rows="leaderboardRows"
      :winner-text="winnerText"
      :phase-label="phaseLabel"
      :round-label="roundLabel"
      :join-link="joinLink"
      :is-connection-degraded="isConnectionDegraded"
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
          <p
            class="text-muted-foreground mt-1 flex flex-wrap items-center gap-2"
          >
            <span>{{ statusText }}</span>
            <Badge v-if="state && roundLabel" variant="secondary">
              {{ roundLabel }}
            </Badge>
          </p>
        </div>
        <Button
          v-if="activeState"
          variant="ghost-outline"
          size="sm"
          :disabled="busy"
          @click="enterPresentMode"
        >
          <Maximize2 class="size-4" />
          {{ $t("providers.music_quiz.enter_present_mode") }}
        </Button>
      </header>

      <MusicQuizConnectionBanners :degraded="isConnectionDegraded" />

      <Card v-if="!state && !loading">
        <CardContent>
          <MusicQuizSetupWizard :busy="busy" @create="handleCreate" />
        </CardContent>
      </Card>

      <MusicQuizUnsupportedGame
        v-else-if="state && !activeState"
        :busy="busy"
        :can-end-game="true"
        @end-game="showEndGameDialog = true"
      />

      <div
        v-else-if="activeState && resolvedDefinition"
        class="flex flex-col gap-4"
      >
        <MusicQuizHostPanel
          :state="activeState"
          :busy="busy"
          :join-link="joinLink"
          :is-last-round="!!isLastRound"
          :reveal-label-key="
            resolvedDefinition.game.revealActionKey ||
            'providers.music_quiz.phase_reveal'
          "
          @end-game="showEndGameDialog = true"
          @start="host.start"
          @reveal="host.reveal"
          @next="host.next"
          @reset="host.reset"
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

    <AlertDialog v-model:open="showEndGameDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ $t("providers.music_quiz.end_game") }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("providers.music_quiz.end_game_confirm") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t("cancel") }}</AlertDialogCancel>
          <AlertDialogAction :disabled="busy" @click="confirmEndGame">
            {{ $t("providers.music_quiz.end_game") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import MusicQuizConnectionBanners from "@/components/music-quiz/MusicQuizConnectionBanners.vue";
import { resolveMusicQuizDefinition } from "@/components/music-quiz/game_types";
import MusicQuizHostPanel from "@/components/music-quiz/MusicQuizHostPanel.vue";
import MusicQuizLeaderboard, {
  type MusicQuizLeaderboardRow,
} from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import MusicQuizPresentStage from "@/components/music-quiz/MusicQuizPresentStage.vue";
import MusicQuizSessionPanels from "@/components/music-quiz/MusicQuizSessionPanels.vue";
import MusicQuizSetupWizard from "@/components/music-quiz/MusicQuizSetupWizard.vue";
import MusicQuizUnsupportedGame from "@/components/music-quiz/MusicQuizUnsupportedGame.vue";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import api, { ConnectionState } from "@/plugins/api";
import { $t } from "@/plugins/i18n";
import { Maximize2 } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { toast } from "vue-sonner";

const host = useMusicQuizHost({
  notifyError: (message) => toast.error(message),
});

const {
  state,
  busy,
  loading,
  currentRound,
  isLastRound,
  joinLink,
  phaseLabel: defaultPhaseLabel,
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
  if (activeState.value?.phase !== "reveal") return defaultPhaseLabel.value;
  return $t(
    resolvedDefinition.value?.game.revealPhaseKey ??
      "providers.music_quiz.phase_reveal",
  );
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

async function handleCreate(request: MusicQuizCreateRequest) {
  await host.create(request);
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
  if (!nextState && presentMode.value) {
    void exitPresentMode();
  }
});

async function confirmEndGame() {
  showEndGameDialog.value = false;
  await host.deleteGame();
}

onMounted(() => {
  document.addEventListener("fullscreenchange", onFullscreenChange);
});

onBeforeUnmount(() => {
  document.removeEventListener("fullscreenchange", onFullscreenChange);
});
</script>
