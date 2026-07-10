<template>
  <div ref="presentRootRef" class="mx-auto w-full max-w-6xl p-4 sm:p-5">
    <MusicQuizPresentStage
      v-if="presentMode && state"
      :state="state"
      :current-round="currentRound"
      :leaderboard-rows="leaderboardRows"
      :answered-count="answeredCount"
      :answer-remaining-label="answerRemainingLabel"
      :answer-remaining-fraction="answerRemainingFraction"
      :winner-text="winnerText"
      :phase-label="phaseLabel"
      :round-label="roundLabel"
      :join-link="joinLink"
      :current-round-image-url="currentRoundImageUrl"
      :is-connection-degraded="isConnectionDegraded"
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
          v-if="state"
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

      <Card v-if="gameRemoved">
        <CardHeader>
          <CardTitle>{{ $t("providers.music_quiz.game_ended") }}</CardTitle>
          <CardDescription>
            {{ $t("providers.music_quiz.game_ended_detail") }}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card v-else-if="!state && !loading">
        <CardContent>
          <MusicQuizSetupWizard :busy="busy" @create="handleCreate" />
        </CardContent>
      </Card>

      <div v-else-if="state" class="flex flex-col gap-4">
        <MusicQuizHostPanel
          :state="state"
          :busy="busy"
          :join-link="joinLink"
          :current-round="currentRound"
          :is-last-round="!!isLastRound"
          @delete="showDeleteDialog = true"
          @start="host.start"
          @reveal="host.reveal"
          @next="host.next"
          @reset="host.reset"
        />

        <Card v-if="state.phase === 'answering' && currentRound">
          <CardContent class="flex flex-col items-center gap-4">
            <MusicQuizCountdown
              :size="120"
              :fraction="answerRemainingFraction"
              :label="answerRemainingLabel || '…'"
            />
            <MusicQuizAnswerGrid
              class="w-full"
              :suggestions="currentRound.suggestions"
              :disabled="true"
              :selected-suggestion-id="null"
              @select="noop"
            />
          </CardContent>
        </Card>

        <MusicQuizReveal
          v-else-if="state.phase === 'reveal' && currentRound"
          :round="currentRound"
          :busy="true"
          :is-ready="true"
          :ready-label="$t('providers.music_quiz.ready')"
          :image-url="currentRoundImageUrl"
          :show-lyrics="false"
          :has-lyrics="false"
          :lyrics="''"
          :lrc-lyrics="''"
          :lyrics-position="0"
          lyrics-text-color="var(--foreground)"
          :show-ready-button="false"
          @ready="noop"
          @copy-title="copyCurrentRoundTitle"
        />

        <MusicQuizSessionPanels :state="state" />
      </div>
    </section>

    <AlertDialog v-model:open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ $t("delete") }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("providers.music_quiz.delete_confirm") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t("cancel") }}</AlertDialogCancel>
          <AlertDialogAction :disabled="busy" @click="confirmDelete">
            {{ $t("delete") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import MusicQuizAnswerGrid from "@/components/music-quiz/MusicQuizAnswerGrid.vue";
import MusicQuizConnectionBanners from "@/components/music-quiz/MusicQuizConnectionBanners.vue";
import MusicQuizCountdown from "@/components/music-quiz/MusicQuizCountdown.vue";
import MusicQuizHostPanel from "@/components/music-quiz/MusicQuizHostPanel.vue";
import { type MusicQuizLeaderboardRow } from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import MusicQuizPresentStage from "@/components/music-quiz/MusicQuizPresentStage.vue";
import MusicQuizReveal from "@/components/music-quiz/MusicQuizReveal.vue";
import MusicQuizSessionPanels from "@/components/music-quiz/MusicQuizSessionPanels.vue";
import MusicQuizSetupWizard from "@/components/music-quiz/MusicQuizSetupWizard.vue";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MusicQuizCreateArgs } from "@/composables/useMusicQuiz";
import { useMusicQuizHost } from "@/composables/useMusicQuizHost";
import { useMusicQuizRoundClocks } from "@/composables/useMusicQuizRoundClocks";
import {
  getMusicQuizRoundScoreLabel,
  getMusicQuizWinnerText,
  rankMusicQuizPlayers,
} from "@/helpers/music_quiz";
import { copyToClipboard, getMediaImageUrl } from "@/helpers/utils";
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
  gameRemoved,
  busy,
  loading,
  currentRound,
  isLastRound,
  joinLink,
  phaseLabel,
} = host;

const clocks = useMusicQuizRoundClocks(
  computed(() => state.value),
  computed(() => currentRound.value),
);
const { answerRemainingLabel, answerRemainingFraction } = clocks;

const rankedPlayers = computed(() =>
  state.value ? rankMusicQuizPlayers(state.value.players) : [],
);

const leaderboardRows = computed<MusicQuizLeaderboardRow[]>(() => {
  const currentState = state.value;
  if (!currentState) return [];
  return rankedPlayers.value.map((player) => ({
    ...player,
    roundScoreLabel: getMusicQuizRoundScoreLabel(currentState, player.name),
  }));
});

const answeredCount = computed(
  () => state.value?.players.filter((player) => player.answered).length ?? 0,
);
const winnerText = computed(() => getMusicQuizWinnerText(rankedPlayers.value));

const roundLabel = computed(() => {
  if (!state.value || !currentRound.value) return "";
  return `${$t("providers.music_quiz.round_label")} ${currentRound.value.round_index + 1} / ${state.value.round_count}`;
});

const statusText = computed(() => {
  if (loading.value) return $t("providers.music_quiz.loading");
  if (gameRemoved.value) return $t("providers.music_quiz.game_removed");
  if (state.value) return phaseLabel.value;
  return $t("providers.music_quiz.no_active_game");
});

const currentRoundImageUrl = computed(() =>
  getMediaImageUrl(currentRound.value?.image_url ?? ""),
);

const isConnectionDegraded = computed(
  () =>
    api.state.value === ConnectionState.RECONNECTING ||
    api.state.value === ConnectionState.DISCONNECTED,
);

const presentMode = ref(false);
const presentRootRef = ref<HTMLElement | null>(null);
const showDeleteDialog = ref(false);

function noop() {
  // Read-only interactions on the host dashboard.
}

async function copyCurrentRoundTitle() {
  if (!currentRound.value?.answer_label) return;
  const copied = await copyToClipboard(currentRound.value.answer_label);
  if (!copied) {
    toast.error($t("providers.music_quiz.copy_music_name_failed"));
  }
}

async function handleCreate(args: MusicQuizCreateArgs) {
  await host.create(
    args.quiz_type,
    args.round_count,
    args.suggestion_count,
    args.answer_duration,
    args.difficulty,
    args.source_uris,
    args.name,
  );
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

async function confirmDelete() {
  showDeleteDialog.value = false;
  await host.deleteGame();
}

onMounted(() => {
  document.addEventListener("fullscreenchange", onFullscreenChange);
});

onBeforeUnmount(() => {
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  clocks.teardown();
});
</script>
