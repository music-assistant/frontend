<template>
  <Card :class="compact ? 'gap-2 py-2' : 'gap-4 py-4'">
    <CardHeader :class="compact ? 'px-3' : 'px-4'">
      <CardTitle :class="compact ? 'text-sm' : 'text-base'">
        {{ title ?? $t("providers.music_quiz.leaderboard") }}
      </CardTitle>
    </CardHeader>
    <CardContent
      :class="
        compact ? 'max-h-56 overflow-y-auto overscroll-contain px-2' : 'px-4'
      "
    >
      <TransitionGroup
        tag="ol"
        name="quiz-rank"
        class="flex flex-col"
        :class="compact ? 'gap-0.5' : 'gap-1'"
      >
        <li
          v-for="row in rows"
          :key="row.name"
          class="flex items-center rounded-lg"
          :class="[
            compact ? 'gap-2 px-1.5 py-1 text-sm' : 'gap-3 px-2 py-1.5',
            { 'bg-primary/10': row.name === currentPlayerName },
          ]"
          :aria-current="row.name === currentPlayerName ? 'true' : undefined"
        >
          <span
            class="text-muted-foreground shrink-0 text-center font-bold tabular-nums"
            :class="compact ? 'w-5' : 'w-6'"
          >
            {{ row.rank }}
          </span>
          <MusicQuizAvatar
            :name="row.name"
            :class="compact ? 'size-6 shrink-0' : 'size-8 shrink-0'"
          />
          <span
            class="min-w-0 flex-1 truncate font-medium"
            :class="{
              'text-primary font-bold': row.name === currentPlayerName,
            }"
          >
            {{ row.name }}
          </span>
          <span class="flex shrink-0 items-baseline gap-1 tabular-nums">
            <strong>{{ row.score }}</strong>
            <span
              v-if="row.roundScoreLabel"
              class="text-primary quiz-score-pop text-xs font-semibold"
            >
              {{ row.roundScoreLabel }}
            </span>
          </span>
        </li>
      </TransitionGroup>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import MusicQuizAvatar from "@/components/music-quiz/MusicQuizAvatar.vue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RankedMusicQuizPlayer } from "@/helpers/music_quiz";
import { $t } from "@/plugins/i18n";

export type MusicQuizLeaderboardRow = RankedMusicQuizPlayer & {
  roundScoreLabel: string;
};

defineProps<{
  rows: MusicQuizLeaderboardRow[];
  currentPlayerName?: string;
  title?: string;
  compact?: boolean;
}>();
</script>

<style scoped>
.quiz-rank-move {
  transition: transform 0.4s ease;
}

.quiz-score-pop {
  animation: quiz-score-pop 0.45s ease;
}

@keyframes quiz-score-pop {
  0% {
    transform: scale(0.6);
    opacity: 0;
  }
  60% {
    transform: scale(1.15);
    opacity: 1;
  }
  100% {
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .quiz-rank-move,
  .quiz-score-pop {
    transition: none;
    animation: none;
  }
}
</style>
