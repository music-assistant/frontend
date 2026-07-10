<template>
  <section v-if="state.phase === 'lobby'" class="flex flex-col gap-3">
    <p class="text-muted-foreground text-center">
      {{ $t("providers.music_quiz.waiting_for_start") }}
    </p>
    <MusicQuizLeaderboard
      :rows="leaderboardRows"
      :current-player-name="state.you.name"
    />
  </section>

  <section
    v-else-if="state.phase === 'answering' && currentRound"
    class="flex flex-col gap-3"
  >
    <div class="flex flex-col items-center gap-2">
      <MusicQuizCountdown
        :size="132"
        :fraction="answerRemainingFraction"
        :label="answerRemainingLabel || '…'"
      />
      <p class="text-lg font-bold">
        {{ $t("providers.music_quiz.choose_answer") }}
      </p>
    </div>
    <MusicQuizAnswerGrid
      :suggestions="currentRound.suggestions"
      :disabled="busy || !!state.you.answer"
      :selected-suggestion-id="state.you.answer?.suggestion_id ?? null"
      @select="emit('answer', $event)"
    />
    <p
      v-if="state.you.answer"
      class="text-muted-foreground text-center"
      role="status"
    >
      {{ $t("providers.music_quiz.answered") }}
    </p>
    <MusicQuizAnswerStatus
      :statuses="state.players"
      :answered-count="answeredCount"
    />
  </section>

  <section
    v-else-if="state.phase === 'reveal' && currentRound"
    class="flex flex-col gap-3"
  >
    <MusicQuizReveal
      :round="currentRound"
      :busy="busy"
      :is-ready="state.you.ready"
      :ready-label="readyLabel"
      :image-url="currentRoundImageUrl"
      :show-lyrics="showRevealLyrics"
      :has-lyrics="hasRevealLyrics"
      :lyrics-loading="isRevealLyricsLoading"
      :lyrics="revealLyrics || ''"
      :lrc-lyrics="revealLrcLyrics || ''"
      :lyrics-position="lyricsPosition"
      lyrics-text-color="var(--foreground)"
      @ready="emit('ready')"
      @copy-title="emit('copy-title')"
    />

    <div
      v-if="state.you.answer?.correct"
      class="flex items-center justify-center gap-2 rounded-md bg-green-500/15 py-2 font-semibold text-green-600 dark:text-green-400"
      role="status"
    >
      <CircleCheck class="size-5" />
      {{ $t("providers.music_quiz.correct") }}
      <span>+{{ state.you.answer.points ?? 0 }}</span>
    </div>
    <div
      v-else
      class="text-destructive flex items-center justify-center gap-2 rounded-md bg-red-500/10 py-2 font-semibold"
      role="status"
    >
      <CircleX class="size-5" />
      {{
        state.you.answer
          ? $t("providers.music_quiz.incorrect")
          : $t("providers.music_quiz.no_answer_submitted")
      }}
    </div>

    <MusicQuizLeaderboard
      :rows="leaderboardRows"
      :current-player-name="state.you.name"
    />
  </section>

  <section v-else-if="state.phase === 'finished'" class="flex flex-col gap-4">
    <div class="flex flex-col items-center gap-1 text-center">
      <Trophy class="size-8 text-yellow-400" />
      <h2 class="text-xl font-bold">
        {{ $t("providers.music_quiz.game_over") }}
      </h2>
      <p class="text-muted-foreground">{{ winnerText }}</p>
    </div>
    <MusicQuizPodium v-if="leaderboardRows.length" :rows="leaderboardRows" />
    <MusicQuizLeaderboard
      :rows="leaderboardRows"
      :current-player-name="state.you.name"
    />
  </section>
</template>

<script setup lang="ts">
import MusicQuizAnswerGrid from "@/components/music-quiz/MusicQuizAnswerGrid.vue";
import MusicQuizAnswerStatus from "@/components/music-quiz/MusicQuizAnswerStatus.vue";
import MusicQuizCountdown from "@/components/music-quiz/MusicQuizCountdown.vue";
import MusicQuizLeaderboard, {
  type MusicQuizLeaderboardRow,
} from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import MusicQuizPodium from "@/components/music-quiz/MusicQuizPodium.vue";
import MusicQuizReveal from "@/components/music-quiz/MusicQuizReveal.vue";
import type {
  MusicQuizCurrentRound,
  MusicQuizSupportedPersonalizedState,
} from "@/composables/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import api from "@/plugins/api";
import { MediaType, type Track } from "@/plugins/api/interfaces";
import { CircleCheck, CircleX, Trophy } from "@lucide/vue";
import { computed, ref, watch } from "vue";

const props = defineProps<{
  state: MusicQuizSupportedPersonalizedState;
  currentRound: MusicQuizCurrentRound | null;
  busy: boolean;
  leaderboardRows: MusicQuizLeaderboardRow[];
  answeredCount: number;
  answerRemainingLabel: string;
  answerRemainingFraction: number | null;
  winnerText: string;
  readyLabel: string;
  currentRoundImageUrl: string;
  lyricsPosition: number;
}>();
const emit = defineEmits<{
  answer: [suggestionId: string];
  ready: [];
  "copy-title": [];
}>();

const revealLyrics = ref<string | null>(null);
const revealLrcLyrics = ref<string | null>(null);
const revealLyricsStatus = ref<
  "idle" | "loading" | "ready" | "empty" | "error"
>("idle");
const hasRevealLyrics = computed(() => revealLyricsStatus.value === "ready");
const isRevealLyricsLoading = computed(
  () => revealLyricsStatus.value === "loading",
);
const showRevealLyrics = computed(() => revealLyricsStatus.value !== "error");
let lyricsRequestCounter = 0;

async function loadRevealLyrics(trackUri: string) {
  const requestId = ++lyricsRequestCounter;
  revealLyricsStatus.value = "loading";
  revealLyrics.value = null;
  revealLrcLyrics.value = null;
  try {
    const item = await api.getItemByUri(trackUri);
    if (requestId !== lyricsRequestCounter) return;
    if (item.media_type !== MediaType.TRACK) {
      revealLyricsStatus.value = "empty";
      return;
    }
    const [lyrics, lrcLyrics] = await api.getTrackLyrics(item as Track);
    if (requestId !== lyricsRequestCounter) return;
    revealLyrics.value = lyrics;
    revealLrcLyrics.value = lrcLyrics;
    revealLyricsStatus.value =
      (lyrics ?? "").trim() || (lrcLyrics ?? "").trim() ? "ready" : "empty";
  } catch (error) {
    if (requestId === lyricsRequestCounter) {
      console.warn("Failed to load quiz lyrics:", error);
      revealLyricsStatus.value = "error";
    }
  }
}

watch(
  () => [props.state.phase, props.currentRound?.track_uri] as const,
  ([phase, trackUri]) => {
    if (phase !== "reveal" || !trackUri) {
      lyricsRequestCounter += 1;
      revealLyrics.value = null;
      revealLrcLyrics.value = null;
      revealLyricsStatus.value = "idle";
      return;
    }
    void loadRevealLyrics(trackUri);
  },
  { immediate: true },
);
</script>
