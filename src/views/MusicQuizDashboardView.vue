<template>
  <div
    ref="presentRootRef"
    class="music-quiz-dashboard"
    :class="{ 'music-quiz-dashboard--present': presentMode && !!state }"
  >
    <section v-if="presentMode && state" class="present-mode">
      <header class="present-mode__header">
        <div class="present-mode__heading">
          <h1>{{ state.name }}</h1>
          <p>
            {{ phaseLabel }}
            <span v-if="roundLabel"> • {{ roundLabel }}</span>
          </p>
        </div>
        <Button variant="ghost-outline" size="lg" @click="exitPresentMode">
          <Minimize2 class="size-5" />
          {{ $t("music_quiz.exit_present_mode") }}
        </Button>
      </header>

      <MusicQuizConnectionBanners :degraded="isConnectionDegraded" />

      <section class="present-mode__body">
        <template v-if="state.phase === 'answering' && currentRound">
          <p class="present-mode__countdown">
            {{ answerRemainingLabel || $t("music_quiz.waiting_for_answers") }}
          </p>
          <MusicQuizAnswerGrid
            class="present-mode__answers"
            :suggestions="currentRound.suggestions"
            :disabled="true"
            :selected-suggestion-id="null"
            @select="noop"
          />
          <MusicQuizAnswerStatus
            class="present-mode__status"
            :statuses="state.players"
            :answered-count="answeredCount"
          />
          <MusicQuizLeaderboard
            class="present-mode__leaderboard"
            :rows="leaderboardRows"
          />
        </template>

        <template v-else-if="state.phase === 'reveal' && currentRound">
          <MusicQuizReveal
            :round="currentRound"
            :busy="true"
            :is-ready="true"
            :ready-label="$t('music_quiz.ready')"
            :image-url="currentRoundImageUrl"
            :show-lyrics="false"
            :has-lyrics="false"
            :lyrics="''"
            :lrc-lyrics="''"
            :lyrics-position="0"
            :lyrics-text-color="'hsl(var(--foreground))'"
            :show-ready-button="false"
            :show-copy-button="false"
            @ready="noop"
            @copy-title="noop"
          />
          <MusicQuizLeaderboard
            class="present-mode__leaderboard"
            :rows="leaderboardRows"
          />
        </template>

        <template v-else-if="state.phase === 'finished'">
          <section class="present-mode__finished">
            <h2>{{ $t("music_quiz.final_leaderboard") }}</h2>
            <p>{{ winnerText }}</p>
          </section>
          <MusicQuizLeaderboard
            class="present-mode__leaderboard"
            :rows="leaderboardRows"
          />
        </template>

        <template v-else>
          <section class="present-mode__lobby">
            <MusicQuizHostPanel
              :state="state"
              :busy="true"
              :join-link="joinLink"
              :current-round="currentRound"
              :is-last-round="!!isLastRound"
              :show-actions="false"
            />
            <MusicQuizSessionPanels :state="state" />
          </section>
        </template>
      </section>
    </section>

    <section v-else class="dashboard-shell">
      <header class="dashboard-shell__header">
        <div>
          <h1>{{ $t("music_quiz.title") }}</h1>
          <p>{{ statusText }}</p>
        </div>
        <Button
          v-if="state"
          variant="ghost-outline"
          size="sm"
          :disabled="busy"
          @click="enterPresentMode"
        >
          <Maximize2 class="size-4" />
          {{ $t("music_quiz.enter_present_mode") }}
        </Button>
      </header>

      <MusicQuizConnectionBanners :degraded="isConnectionDegraded" />

      <div v-if="gameRemoved" class="dashboard-shell__card">
        <h2>{{ $t("music_quiz.game_ended") }}</h2>
        <p>{{ $t("music_quiz.game_ended_detail") }}</p>
      </div>

      <div v-else-if="!state && !loading" class="dashboard-shell__card">
        <p>{{ $t("music_quiz.create_intro") }}</p>
        <MusicQuizSetupForm :busy="busy" @create="handleCreate" />
      </div>

      <div v-else-if="state" class="dashboard-shell__content">
        <MusicQuizHostPanel
          :state="state"
          :busy="busy"
          :join-link="joinLink"
          :current-round="currentRound"
          :is-last-round="!!isLastRound"
          @delete="deleteGame"
          @start="host.start"
          @reveal="host.reveal"
          @next="host.next"
          @reset="host.reset"
        />

        <section
          v-if="state.phase === 'answering' && currentRound"
          class="dashboard-shell__card"
        >
          <p class="dashboard-shell__countdown">
            {{ answerRemainingLabel || $t("music_quiz.waiting_for_answers") }}
          </p>
          <MusicQuizAnswerGrid
            :suggestions="currentRound.suggestions"
            :disabled="true"
            :selected-suggestion-id="null"
            @select="noop"
          />
        </section>

        <section v-else-if="state.phase === 'reveal' && currentRound">
          <MusicQuizReveal
            :round="currentRound"
            :busy="true"
            :is-ready="true"
            :ready-label="$t('music_quiz.ready')"
            :image-url="currentRoundImageUrl"
            :show-lyrics="false"
            :has-lyrics="false"
            :lyrics="''"
            :lrc-lyrics="''"
            :lyrics-position="0"
            :lyrics-text-color="'hsl(var(--foreground))'"
            :show-ready-button="false"
            @ready="noop"
            @copy-title="copyCurrentRoundTitle"
          />
        </section>

        <MusicQuizSessionPanels :state="state" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import MusicQuizAnswerGrid from "@/components/music-quiz/MusicQuizAnswerGrid.vue";
import MusicQuizAnswerStatus from "@/components/music-quiz/MusicQuizAnswerStatus.vue";
import MusicQuizConnectionBanners from "@/components/music-quiz/MusicQuizConnectionBanners.vue";
import MusicQuizHostPanel from "@/components/music-quiz/MusicQuizHostPanel.vue";
import MusicQuizLeaderboard, {
  type MusicQuizLeaderboardRow,
} from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import MusicQuizReveal from "@/components/music-quiz/MusicQuizReveal.vue";
import MusicQuizSessionPanels from "@/components/music-quiz/MusicQuizSessionPanels.vue";
import MusicQuizSetupForm from "@/components/music-quiz/MusicQuizSetupForm.vue";
import { Button } from "@/components/ui/button";
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
import { Maximize2, Minimize2 } from "@lucide/vue";
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

const { answerRemainingLabel } = clocks;

const rankedPlayers = computed(() => {
  if (!state.value) return [];
  return rankMusicQuizPlayers(state.value.players);
});

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
  return `${$t("music_quiz.round_label")} ${currentRound.value.round_index + 1} / ${state.value.round_count}`;
});

const statusText = computed(() => {
  if (loading.value) return $t("music_quiz.loading");
  if (gameRemoved.value) return $t("music_quiz.game_removed");
  if (state.value) return phaseLabel.value;
  return $t("music_quiz.no_active_game");
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

function noop() {
  // Intentionally empty for read-only interactions.
}

async function copyCurrentRoundTitle() {
  if (!currentRound.value?.answer_label) return;
  const copied = await copyToClipboard(currentRound.value.answer_label);
  if (!copied) {
    toast.error($t("music_quiz.copy_music_name_failed"));
  }
}

async function handleCreate(args: MusicQuizCreateArgs) {
  await host.create(
    "guess_the_song",
    args.round_count,
    args.suggestion_count,
    args.answer_duration,
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

async function deleteGame() {
  if (!window.confirm($t("music_quiz.delete_confirm"))) return;
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

<style scoped>
.music-quiz-dashboard {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 1.25rem;
}

.music-quiz-dashboard--present {
  max-width: none;
  padding: 0;
}

.dashboard-shell {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.dashboard-shell__header,
.dashboard-shell__card {
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  background: hsl(var(--card));
  padding: 1rem;
}

.dashboard-shell__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.dashboard-shell__header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.dashboard-shell__header p,
.dashboard-shell__card p {
  margin: 0.35rem 0 0;
  color: hsl(var(--muted-foreground));
}

.dashboard-shell__content {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.dashboard-shell__countdown {
  margin: 0 0 0.65rem;
  text-align: center;
  font-size: 1.45rem;
  font-weight: 700;
}

.present-mode {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: hsl(var(--background));
  padding: 1.2rem;
}

.present-mode__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.present-mode__heading h1 {
  margin: 0;
  font-size: clamp(1.8rem, 3.4vw, 3.1rem);
}

.present-mode__heading p {
  margin: 0.35rem 0 0;
  font-size: clamp(1rem, 1.8vw, 1.5rem);
  color: hsl(var(--muted-foreground));
}

.present-mode__body {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 1rem;
}

.present-mode__countdown {
  margin: 0;
  text-align: center;
  font-size: clamp(2.1rem, 5.8vw, 5.8rem);
  font-weight: 800;
}

.present-mode__answers :deep(.quiz-answers) {
  padding: 1rem;
  border-radius: 12px;
}

.present-mode__answers :deep(.quiz-answers__button) {
  min-height: clamp(4.2rem, 8.5vh, 7rem);
  font-size: clamp(1rem, 1.9vw, 1.9rem);
  font-weight: 700;
}

.present-mode__status :deep(li),
.present-mode__leaderboard :deep(li) {
  min-height: 2.8rem;
  font-size: clamp(0.95rem, 1.4vw, 1.35rem);
}

.present-mode__lobby {
  display: grid;
  grid-template-columns: minmax(280px, 520px) minmax(0, 1fr);
  gap: 1rem;
}

.present-mode__finished {
  text-align: center;
}

.present-mode__finished h2 {
  margin: 0;
  font-size: clamp(1.5rem, 3vw, 2.7rem);
}

.present-mode__finished p {
  margin: 0.7rem 0 0;
  font-size: clamp(1rem, 2vw, 1.8rem);
}

@media (max-width: 980px) {
  .present-mode__lobby {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .music-quiz-dashboard {
    padding: 0.75rem;
  }

  .dashboard-shell__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .present-mode {
    padding: 0.8rem;
  }

  .present-mode__header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
