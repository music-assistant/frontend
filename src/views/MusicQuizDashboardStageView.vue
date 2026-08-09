<template>
  <div
    class="music-quiz-dashboard dark text-white"
    data-testid="music-quiz-dashboard-stage"
  >
    <div
      v-if="backdropUrl"
      class="music-quiz-dashboard-backdrop"
      :style="{ backgroundImage: `url(${backdropUrl})` }"
      data-testid="music-quiz-dashboard-backdrop"
    ></div>
    <div class="music-quiz-dashboard-scrim"></div>

    <div class="music-quiz-dashboard-content">
      <MusicQuizConnectionBanners :degraded="isConnectionDegraded" />

      <template v-if="activeState && resolvedDefinition">
        <header class="flex items-start justify-between gap-6">
          <div class="min-w-0">
            <h1
              class="truncate text-[clamp(1.75rem,3.4vw,3rem)] leading-tight font-bold text-white/95"
            >
              {{ activeState.name || $t("providers.music_quiz.title") }}
            </h1>
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              class="mt-1 text-[clamp(0.95rem,1.5vw,1.6rem)] font-semibold tracking-[0.15em] text-white/45 uppercase"
            >
              {{ phaseLabel }}
            </p>
          </div>
          <p
            v-if="roundLabel"
            class="shrink-0 rounded-full bg-white/10 px-[1.2em] py-[0.45em] text-[clamp(1rem,1.7vw,1.9rem)] font-semibold text-white/70"
            data-testid="music-quiz-dashboard-round"
          >
            {{ roundLabel }}
          </p>
        </header>

        <MusicQuizPreparingState
          v-if="activeState.preparing"
          class="min-h-0 flex-1"
        />

        <div
          v-else-if="activeState.phase === 'lobby'"
          data-testid="music-quiz-dashboard-lobby"
          class="grid min-h-0 flex-1 items-center gap-[4vh] lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-[4vw]"
        >
          <MusicQuizQrCard
            v-if="joinLink"
            class="mx-auto w-full max-w-sm lg:w-[22rem]"
            :join-link="joinLink"
            :size="300"
            hide-share-actions
            :caption="$t('providers.music_quiz.invite_players')"
          />
          <div class="flex min-h-0 min-w-0 flex-col gap-[2vh] self-stretch">
            <h2
              class="text-[clamp(1.4rem,2.6vw,2.4rem)] font-bold text-white/90"
            >
              {{ $t("providers.music_quiz.players") }}
              <span class="text-white/50">
                ({{ activeState.players.length }})
              </span>
            </h2>
            <MusicQuizAutoStartStatus
              :state="activeState"
              class="w-fit rounded-full bg-white/10 px-[1.1em] py-[0.4em] text-[clamp(1rem,1.7vw,1.75rem)] font-semibold text-white/75"
            />
            <div
              v-if="activeState.players.length"
              data-testid="music-quiz-dashboard-player-grid"
              class="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3 overflow-y-auto"
            >
              <MusicQuizPlayerTile
                v-for="player in sortedPlayers"
                :key="player.name"
                :name="player.name"
                class="border-white/10 bg-white/10 text-[clamp(1rem,1.4vw,1.5rem)]"
              />
            </div>
            <p v-else class="text-[clamp(1rem,1.7vw,1.75rem)] text-white/60">
              {{ $t("providers.music_quiz.waiting_for_start") }}
            </p>
          </div>
        </div>

        <div
          v-else-if="isRoundPhase && currentRound"
          data-testid="music-quiz-dashboard-round-body"
          class="flex min-h-0 flex-1 flex-col gap-[2vh]"
        >
          <component
            :is="resolvedDefinition.game.adapters.presentBody"
            v-if="resolvedDefinition.game.adapters.presentBody"
            :state="activeState"
            :current-round="currentRound"
            :leaderboard-rows="visibleLeaderboardRows"
          />
          <template v-else-if="activeState.phase === 'reveal'">
            <div
              data-testid="music-quiz-dashboard-reveal-layout"
              class="grid min-h-0 flex-1 gap-[2vh] lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-[2vw]"
            >
              <component
                :is="resolvedDefinition.game.adapters.present"
                :state="activeState"
                :current-round="currentRound"
              />
              <component
                :is="resolvedDefinition.answer.adapters.present"
                :state="activeState"
                :current-round="currentRound"
              >
                <template #leaderboard>
                  <MusicQuizLeaderboard
                    class="min-h-0 flex-1"
                    :rows="visibleLeaderboardRows"
                    scrollable
                  />
                </template>
              </component>
            </div>
          </template>
          <template v-else>
            <p
              v-if="answeringPrompt"
              data-testid="music-quiz-dashboard-listening"
              class="text-[clamp(1.5rem,3vw,2.8rem)] font-bold text-white/90"
            >
              {{ answeringPrompt }}
            </p>
            <component
              :is="resolvedDefinition.game.adapters.present"
              :state="activeState"
              :current-round="currentRound"
            />
            <component
              :is="resolvedDefinition.answer.adapters.present"
              :state="activeState"
              :current-round="currentRound"
            >
              <template #leaderboard>
                <MusicQuizLeaderboard
                  class="min-h-0 flex-1"
                  :rows="visibleLeaderboardRows"
                  scrollable
                />
              </template>
            </component>
          </template>
          <p
            v-if="revealCountdownText"
            data-testid="music-quiz-dashboard-next-round"
            role="timer"
            class="mx-auto w-fit rounded-full bg-white/10 px-[1.2em] py-[0.45em] text-[clamp(1rem,1.7vw,1.9rem)] font-semibold text-white/75"
          >
            {{ revealCountdownText }}
          </p>
        </div>

        <div
          v-else-if="activeState.phase === 'finished'"
          data-testid="music-quiz-dashboard-finished"
          class="flex min-h-0 flex-1 flex-col items-center justify-center gap-[3vh]"
        >
          <p
            class="text-center text-[clamp(1.6rem,3vw,3rem)] font-bold text-white/95"
          >
            {{ winnerText }}
          </p>
          <MusicQuizPodium
            v-if="leaderboardRows.length"
            :rows="leaderboardRows"
          />
          <div v-if="leaderboardRows.length > 3" class="w-full max-w-3xl">
            <MusicQuizLeaderboard :rows="visibleLeaderboardRows" />
          </div>
        </div>
      </template>

      <div
        v-else-if="!loading"
        data-testid="music-quiz-dashboard-waiting"
        class="flex min-h-0 flex-1 flex-col items-center justify-center gap-[2vh] text-center"
      >
        <Disc3 class="size-[12vh] text-white/25" aria-hidden="true" />
        <p class="text-[clamp(1.25rem,2.4vw,2.25rem)] text-white/60">
          {{ $t("providers.music_quiz.dashboard_waiting") }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MusicQuizAutoStartStatus from "@/components/music-quiz/MusicQuizAutoStartStatus.vue";
import MusicQuizConnectionBanners from "@/components/music-quiz/MusicQuizConnectionBanners.vue";
import MusicQuizLeaderboard, {
  type MusicQuizLeaderboardRow,
} from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import MusicQuizPlayerTile from "@/components/music-quiz/MusicQuizPlayerTile.vue";
import MusicQuizPodium from "@/components/music-quiz/MusicQuizPodium.vue";
import MusicQuizPreparingState from "@/components/music-quiz/MusicQuizPreparingState.vue";
import MusicQuizQrCard from "@/components/music-quiz/MusicQuizQrCard.vue";
import {
  getMusicQuizPhaseLabelKey,
  resolveMusicQuizDefinition,
} from "@/components/music-quiz/game_types";
import { isSupportedMusicQuiz } from "@/composables/music-quiz/useMusicQuiz";
import { useMusicQuizCelebration } from "@/composables/music-quiz/useMusicQuizCelebration";
import { useMusicQuizDashboard } from "@/composables/music-quiz/useMusicQuizDashboard";
import { useMusicQuizRevealCountdown } from "@/composables/music-quiz/useMusicQuizRevealCountdown";
import {
  getMusicQuizRoundScoreLabel,
  getMusicQuizWinnerText,
  rankMusicQuizPlayers,
} from "@/helpers/music_quiz";
import { getMediaImageUrl } from "@/helpers/utils";
import api, { ConnectionState } from "@/plugins/api";
import { $t } from "@/plugins/i18n";
import { Disc3 } from "@lucide/vue";
import { computed, watch } from "vue";

const { state, currentRound, joinLink, loading } = useMusicQuizDashboard();

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

const sortedPlayers = computed(() =>
  activeState.value
    ? [...activeState.value.players].sort((a, b) =>
        a.name.localeCompare(b.name),
      )
    : [],
);

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

// A TV is read from across the room: only the head of the board stays legible.
const visibleLeaderboardRows = computed(() =>
  leaderboardRows.value.slice(
    0,
    activeState.value?.phase === "answering" ? 6 : 8,
  ),
);

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

const isRoundPhase = computed(
  () =>
    activeState.value?.phase === "answering" ||
    activeState.value?.phase === "reveal",
);

const answeringPrompt = computed(() => {
  const promptKey = resolvedDefinition.value?.game.answeringPromptKey;
  return activeState.value?.phase === "answering" && promptKey
    ? $t(promptKey)
    : "";
});

const backdropUrl = computed(() => {
  const phase = activeState.value?.phase;
  if (phase !== "reveal" && phase !== "finished") return "";
  return getMediaImageUrl(currentRound.value?.image_url ?? "");
});

const isFinalRound = computed(
  () =>
    !!activeState.value &&
    !!currentRound.value &&
    currentRound.value.round_index + 1 >= activeState.value.round_count,
);

const { hasElapsed, isScheduled, remainingLabel } = useMusicQuizRevealCountdown(
  {
    active: () => activeState.value?.phase === "reveal",
    autoAdvanceAt: () => currentRound.value?.auto_advance_at,
  },
);

const revealCountdownText = computed(() => {
  // some game types (Trivia) render this countdown in their own present adapter
  if (resolvedDefinition.value?.game.usesRevealCountdown) return "";
  if (activeState.value?.phase !== "reveal" || !isScheduled.value) return "";
  if (hasElapsed.value) {
    return $t(
      isFinalRound.value
        ? "providers.music_quiz.waiting_for_final_results"
        : "providers.music_quiz.waiting_for_next",
    );
  }
  return $t(
    isFinalRound.value
      ? "providers.music_quiz.final_results_in"
      : "providers.music_quiz.next_round_in",
    [remainingLabel.value],
  );
});

const isConnectionDegraded = computed(
  () =>
    api.state.value === ConnectionState.RECONNECTING ||
    api.state.value === ConnectionState.DISCONNECTED,
);

const { celebrate } = useMusicQuizCelebration();

watch(
  () => activeState.value?.phase,
  (phase) => {
    if (phase === "finished") void celebrate();
  },
  { immediate: true },
);
</script>

<style scoped>
.music-quiz-dashboard {
  position: relative;
  width: 100%;
  height: 100vh;
  /* also crops the backdrop's blurred edges, which bleed past the viewport */
  overflow: hidden;
  background: #000;
}

/* Keep the vh fallback in a separate rule: the minifier collapses duplicate
   declarations, which would drop it and leave Android TV without a height. */
@supports (height: 100dvh) {
  .music-quiz-dashboard {
    height: 100dvh;
  }
}

.music-quiz-dashboard-backdrop {
  position: absolute;
  /* overscanned so the blur has material to sample at every edge */
  inset: -10%;
  background-position: center;
  background-size: cover;
  filter: blur(80px);
  opacity: 0.35;
  transition: opacity 1s ease;
}

.music-quiz-dashboard-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.35),
    rgba(0, 0, 0, 0.75)
  );
}

.music-quiz-dashboard-content {
  position: relative;
  display: flex;
  height: 100%;
  flex-direction: column;
  gap: 3vh;
  padding: 4vh 4vw;
  box-sizing: border-box;
}

@media (prefers-reduced-motion: reduce) {
  .music-quiz-dashboard-backdrop {
    transition: none;
  }
}
</style>
