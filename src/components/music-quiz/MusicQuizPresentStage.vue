<template>
  <section
    data-testid="music-quiz-present-stage"
    class="bg-background flex min-h-dvh flex-col gap-3 p-3 sm:gap-4 sm:p-5 lg:h-full lg:min-h-0 lg:overflow-hidden"
  >
    <MusicQuizSessionHeader
      :game="game"
      :name="state.name"
      :phase-label="phaseLabel"
      :round-label="roundLabel"
      :mode="state.mode"
      :listen-in-enabled="listenInEnabled"
      present
    >
      <template #actions>
        <Button variant="ghost-outline" size="sm" @click="emit('exit')">
          <Minimize2 class="size-4" />
          {{ $t("providers.music_quiz.exit_present_mode") }}
        </Button>
      </template>
    </MusicQuizSessionHeader>

    <MusicQuizConnectionBanners :degraded="isConnectionDegraded" />

    <div class="flex min-h-0 flex-1 flex-col gap-4">
      <component
        :is="game.adapters.presentBody"
        v-if="
          game.adapters.presentBody &&
          currentRound &&
          (state.phase === 'answering' || state.phase === 'reveal')
        "
        :state="state"
        :current-round="currentRound"
        :leaderboard-rows="leaderboardRows"
      />

      <template v-else-if="state.phase === 'answering' && currentRound">
        <component
          :is="gameComponent"
          :state="state"
          :current-round="currentRound"
        />
        <component
          :is="answerComponent"
          :state="state"
          :current-round="currentRound"
        >
          <template #leaderboard>
            <MusicQuizLeaderboard
              class="min-h-0 flex-1"
              :rows="leaderboardRows"
              scrollable
            />
          </template>
        </component>
      </template>

      <template v-else-if="state.phase === 'reveal' && currentRound">
        <div
          class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]"
        >
          <component
            :is="gameComponent"
            :state="state"
            :current-round="currentRound"
          />
          <component
            :is="answerComponent"
            :state="state"
            :current-round="currentRound"
          >
            <template #leaderboard>
              <MusicQuizLeaderboard
                class="min-h-0 flex-1"
                :rows="leaderboardRows"
                scrollable
              />
            </template>
          </component>
        </div>
      </template>

      <template v-else-if="state.phase === 'finished'">
        <div
          data-testid="music-quiz-present-finished"
          class="flex min-h-0 flex-1 flex-col gap-6 lg:overflow-y-auto"
        >
          <div class="flex flex-col items-center gap-1 text-center">
            <h2 class="text-2xl font-black sm:text-3xl lg:text-4xl">
              {{ $t("providers.music_quiz.final_leaderboard") }}
            </h2>
            <p class="text-muted-foreground text-lg">{{ winnerText }}</p>
          </div>
          <MusicQuizPodium
            v-if="leaderboardRows.length"
            :rows="leaderboardRows"
          />
          <div class="mx-auto w-full max-w-2xl">
            <MusicQuizLeaderboard :rows="leaderboardRows" />
          </div>
        </div>
      </template>

      <template v-else>
        <div
          data-testid="music-quiz-present-lobby"
          class="grid min-h-0 flex-1 items-start gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:overflow-y-auto"
        >
          <MusicQuizQrCard
            class="mx-auto w-full max-w-sm lg:w-80"
            :join-link="joinLink"
            :size="260"
            :caption="$t('providers.music_quiz.invite_players')"
          />
          <div class="flex flex-col gap-4">
            <h2 class="text-xl font-bold">
              {{ $t("providers.music_quiz.players") }}
              <span class="text-muted-foreground">
                ({{ state.players.length }})
              </span>
            </h2>
            <MusicQuizAutoStartStatus
              :state="state"
              class="text-muted-foreground text-lg font-semibold"
            />
            <TransitionGroup
              v-if="state.players.length"
              tag="div"
              name="quiz-tile"
              class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2"
            >
              <MusicQuizPlayerTile
                v-for="player in sortedPlayers"
                :key="player.name"
                :name="player.name"
              />
            </TransitionGroup>
            <p v-else class="text-muted-foreground">
              {{ $t("providers.music_quiz.waiting_for_start") }}
            </p>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import MusicQuizAutoStartStatus from "@/components/music-quiz/MusicQuizAutoStartStatus.vue";
import MusicQuizConnectionBanners from "@/components/music-quiz/MusicQuizConnectionBanners.vue";
import MusicQuizLeaderboard, {
  type MusicQuizLeaderboardRow,
} from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import MusicQuizPodium from "@/components/music-quiz/MusicQuizPodium.vue";
import MusicQuizPlayerTile from "@/components/music-quiz/MusicQuizPlayerTile.vue";
import MusicQuizQrCard from "@/components/music-quiz/MusicQuizQrCard.vue";
import type { MusicQuizGameDefinition } from "@/components/music-quiz/game_types";
import MusicQuizSessionHeader from "@/components/music-quiz/MusicQuizSessionHeader.vue";
import { Button } from "@/components/ui/button";
import type {
  MusicQuizCurrentRound,
  MusicQuizSupportedHostState,
} from "@/composables/useMusicQuiz";
import { useMusicQuizCelebration } from "@/composables/useMusicQuizCelebration";
import { $t } from "@/plugins/i18n";
import { Minimize2 } from "@lucide/vue";
import { computed, watch, type Component } from "vue";

const props = defineProps<{
  state: MusicQuizSupportedHostState;
  game: MusicQuizGameDefinition;
  currentRound: MusicQuizCurrentRound | null;
  leaderboardRows: MusicQuizLeaderboardRow[];
  winnerText: string;
  phaseLabel: string;
  roundLabel: string;
  joinLink: string;
  isConnectionDegraded: boolean;
  listenInEnabled?: boolean;
  gameComponent: Component;
  answerComponent: Component;
}>();
const emit = defineEmits<{ exit: [] }>();

const { celebrate } = useMusicQuizCelebration();

const sortedPlayers = computed(() =>
  [...props.state.players].sort((a, b) => a.name.localeCompare(b.name)),
);

watch(
  () => props.state.phase,
  (phase) => {
    if (phase === "finished") void celebrate();
  },
  { immediate: true },
);
</script>

<style scoped>
.quiz-tile-enter-active {
  transition:
    transform 0.25s ease,
    opacity 0.25s ease;
}

.quiz-tile-enter-from {
  transform: scale(0.8);
  opacity: 0;
}

.quiz-tile-move {
  transition: transform 0.25s ease;
}

@media (prefers-reduced-motion: reduce) {
  .quiz-tile-enter-active,
  .quiz-tile-move {
    transition: none;
  }
}
</style>
