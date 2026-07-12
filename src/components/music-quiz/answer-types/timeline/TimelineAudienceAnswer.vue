<template>
  <div
    data-testid="timeline-audience-answer"
    class="flex flex-col gap-4"
    :class="{ 'lg:h-full lg:min-h-0 lg:overflow-hidden': present }"
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
      v-if="showTimeline"
      :entries="currentRound.timeline"
      :highlighted-entry-id="currentRound.revealed_entry?.entry_id"
    />

    <div
      class="grid gap-4"
      :class="{
        'lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden':
          present && state.phase === 'answering',
        'lg:min-h-0 lg:flex-1 lg:grid-rows-[minmax(7rem,2fr)_minmax(9rem,3fr)] lg:overflow-hidden':
          present && state.phase === 'reveal' && revealedResults.length,
        'lg:min-h-0 lg:flex-1 lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden':
          present && state.phase === 'reveal' && !revealedResults.length,
        'lg:grid-cols-2': !present,
      }"
    >
      <TimelineProgress
        v-if="state.phase === 'answering'"
        :statuses="roundPlayerStatuses"
        :scrollable="present"
      />

      <Card
        v-if="state.phase === 'reveal' && revealedResults.length"
        data-testid="timeline-round-results"
        role="region"
        :aria-label="$t('providers.music_quiz.timeline_round_results')"
        :class="{
          'lg:min-h-0 lg:gap-3 lg:overflow-hidden lg:py-3': present,
        }"
      >
        <CardHeader :class="{ 'lg:px-4': present }">
          <CardTitle class="text-base">
            {{ $t("providers.music_quiz.timeline_round_results") }}
          </CardTitle>
        </CardHeader>
        <CardContent
          :class="{
            'lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:px-4':
              present,
          }"
        >
          <ul class="flex flex-col gap-2">
            <li
              v-for="result in revealedResults"
              :key="result.name"
              class="bg-muted flex items-center justify-between gap-3 rounded-md px-3 py-2"
            >
              <span class="min-w-0 flex-1 truncate font-medium">
                {{ result.name }}
              </span>
              <span
                data-testid="timeline-result-score"
                class="flex min-w-0 max-w-[45%] items-center gap-1 font-semibold tabular-nums"
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
                <span class="min-w-0 flex-1 truncate">
                  +{{ result.points }}
                </span>
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <div
        v-if="present"
        data-testid="timeline-leaderboard-region"
        class="lg:min-h-0 lg:overflow-hidden"
      >
        <slot name="leaderboard" />
      </div>
      <slot v-else name="leaderboard" />
    </div>
  </div>
</template>

<script setup lang="ts">
import TimelineDisplay from "@/components/music-quiz/answer-types/timeline/TimelineDisplay.vue";
import TimelineProgress from "@/components/music-quiz/answer-types/timeline/TimelineProgress.vue";
import MusicQuizCountdown from "@/components/music-quiz/MusicQuizCountdown.vue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  MusicQuizTimelineHostState,
  MusicQuizTimelineRound,
} from "@/composables/useMusicQuiz";
import { useMusicQuizAnswerDeadline } from "@/composables/useMusicQuizAnswerDeadline";
import { getMusicQuizRoundPlayers } from "@/helpers/music_quiz";
import { $t } from "@/plugins/i18n";
import { CircleCheck, CircleX } from "@lucide/vue";
import { computed, type VNode } from "vue";

const props = withDefaults(
  defineProps<{
    state: MusicQuizTimelineHostState;
    currentRound: MusicQuizTimelineRound;
    present?: boolean;
    showTimeline?: boolean;
  }>(),
  {
    present: false,
    showTimeline: true,
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
const roundPlayerStatuses = computed(() =>
  getMusicQuizRoundPlayers(props.state.players, props.currentRound.round_index),
);
const { remainingLabel, remainingFraction } = useMusicQuizAnswerDeadline({
  active: () => props.state.phase === "answering",
  deadline: () => props.currentRound.deadline,
  duration: () => props.state.answer_duration,
});
</script>
