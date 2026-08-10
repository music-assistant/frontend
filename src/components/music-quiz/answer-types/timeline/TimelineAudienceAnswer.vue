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
        'lg:min-h-0 lg:flex-1 lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden':
          present && state.phase === 'reveal',
        'lg:grid-cols-2': !present,
      }"
    >
      <TimelineProgress
        v-if="state.phase === 'answering'"
        :statuses="roundPlayerStatuses"
        :scrollable="present"
      />

      <!-- the big screen keeps standings for the reveal; scores mid-guess spoil the race -->
      <div
        v-if="present && state.phase === 'reveal'"
        data-testid="timeline-leaderboard-region"
        class="lg:min-h-0 lg:overflow-hidden"
      >
        <slot name="leaderboard"></slot>
      </div>
      <slot v-else-if="!present" name="leaderboard"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import TimelineDisplay from "@/components/music-quiz/answer-types/timeline/TimelineDisplay.vue";
import TimelineProgress from "@/components/music-quiz/answer-types/timeline/TimelineProgress.vue";
import MusicQuizCountdown from "@/components/music-quiz/MusicQuizCountdown.vue";
import type {
  MusicQuizTimelinePublicState,
  MusicQuizTimelineRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { useMusicQuizAnswerDeadline } from "@/composables/music-quiz/useMusicQuizAnswerDeadline";
import { getMusicQuizRoundPlayers } from "@/helpers/music_quiz";
import { computed, type VNode } from "vue";

const props = withDefaults(
  defineProps<{
    state: MusicQuizTimelinePublicState;
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

const roundPlayerStatuses = computed(() =>
  getMusicQuizRoundPlayers(props.state.players, props.currentRound.round_index),
);
const { remainingLabel, remainingFraction } = useMusicQuizAnswerDeadline({
  active: () => props.state.phase === "answering",
  deadline: () => props.currentRound.deadline,
  duration: () => props.state.answer_duration,
});
</script>
