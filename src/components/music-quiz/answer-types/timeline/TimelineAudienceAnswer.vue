<template>
  <div
    class="flex flex-col gap-4"
    :class="
      present && state.phase === 'reveal'
        ? 'max-h-[calc(100dvh-8rem)] overflow-y-auto pr-1'
        : ''
    "
  >
    <div
      v-if="state.phase === 'answering'"
      class="flex flex-col items-center gap-2"
    >
      <MusicQuizCountdown
        :size="present ? 150 : 112"
        :fraction="remainingFraction"
        :label="remainingLabel || '…'"
      />
    </div>

    <TimelineDisplay
      :entries="currentRound.timeline"
      :highlighted-entry-id="currentRound.revealed_entry?.entry_id"
    />

    <div
      class="grid gap-4"
      :class="
        present && state.phase === 'answering'
          ? 'lg:grid-cols-[minmax(0,1fr)_22rem]'
          : !present
            ? 'lg:grid-cols-2'
            : ''
      "
    >
      <TimelineProgress
        v-if="state.phase === 'answering'"
        :statuses="state.players"
      />

      <Card v-if="state.phase === 'reveal' && revealedResults.length">
        <CardHeader>
          <CardTitle class="text-base">
            {{ $t("providers.music_quiz.timeline_round_results") }}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul class="flex flex-col gap-2">
            <li
              v-for="result in revealedResults"
              :key="result.name"
              class="bg-muted flex items-center justify-between gap-3 rounded-md px-3 py-2"
            >
              <span class="truncate font-medium">{{ result.name }}</span>
              <span
                class="flex shrink-0 items-center gap-1 font-semibold tabular-nums"
                :class="
                  result.correct
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-muted-foreground'
                "
              >
                <CircleCheck
                  v-if="result.correct"
                  class="size-4"
                  aria-hidden="true"
                />
                <CircleX v-else class="size-4" aria-hidden="true" />
                <span class="sr-only">
                  {{
                    result.correct
                      ? $t("providers.music_quiz.correct")
                      : $t("providers.music_quiz.incorrect")
                  }}
                </span>
                +{{ result.points }}
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <slot name="leaderboard" />
    </div>
  </div>
</template>

<script setup lang="ts">
import TimelineDisplay from "@/components/music-quiz/answer-types/timeline/TimelineDisplay.vue";
import TimelineProgress from "@/components/music-quiz/answer-types/timeline/TimelineProgress.vue";
import MusicQuizCountdown from "@/components/music-quiz/MusicQuizCountdown.vue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  MusicQuizHitsterHostState,
  MusicQuizHitsterRound,
} from "@/composables/useMusicQuiz";
import { useMusicQuizAnswerDeadline } from "@/composables/useMusicQuizAnswerDeadline";
import { $t } from "@/plugins/i18n";
import { CircleCheck, CircleX } from "@lucide/vue";
import { computed, type VNode } from "vue";

const props = withDefaults(
  defineProps<{
    state: MusicQuizHitsterHostState;
    currentRound: MusicQuizHitsterRound;
    present?: boolean;
  }>(),
  {
    present: false,
  },
);
defineSlots<{ leaderboard: () => VNode[] }>();

const revealedResults = computed(() =>
  props.state.players.flatMap((player) => {
    const answer = player.last_answer;
    if (!answer) return [];
    return [
      {
        name: player.name,
        correct: answer.placement.correct,
        points:
          answer.placement.points +
          (answer.artist?.points ?? 0) +
          (answer.title?.points ?? 0),
      },
    ];
  }),
);
const { remainingLabel, remainingFraction } = useMusicQuizAnswerDeadline({
  active: () => props.state.phase === "answering",
  deadline: () => props.currentRound.deadline,
  duration: () => props.state.answer_duration,
});
</script>
