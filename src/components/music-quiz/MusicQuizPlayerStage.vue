<template>
  <MusicQuizPreparingState
    v-if="state.preparing"
    class="rounded-xl border shadow-sm"
  />

  <section v-else-if="state.phase === 'lobby'" class="flex flex-col gap-3">
    <MusicQuizYoureIn>
      <MusicQuizAutoStartStatus
        v-if="state.auto_start_at != null"
        :state="state"
      />
      <template v-else>
        {{ $t("providers.music_quiz.waiting_for_start") }}
      </template>
    </MusicQuizYoureIn>
    <!-- Before the game nobody has a rank or a score yet. -->
    <MusicQuizLeaderboard
      :rows="leaderboardRows"
      :current-player-name="state.you.name"
      :title="$t('providers.music_quiz.players')"
      hide-scores
    />
  </section>

  <section
    v-else-if="
      (state.phase === 'answering' || state.phase === 'reveal') && currentRound
    "
    ref="answeringSectionRef"
    class="flex flex-col gap-3 scroll-mt-3"
  >
    <div
      v-if="state.phase === 'answering'"
      class="bg-background sticky top-0 z-10 flex flex-col items-center pt-1 pb-2"
    >
      <MusicQuizTimerBar
        :fraction="remainingFraction"
        :label="remainingLabel || '…'"
      />
    </div>
    <component
      :is="gameComponent"
      :state="state"
      :current-round="currentRound"
      :busy="busy"
      @ready="emit('ready')"
    />
    <!-- Someone who joined mid-round can't answer this one. -->
    <MusicQuizYoureIn v-if="joinedMidRound" class="rounded-xl border">
      {{ $t("providers.music_quiz.late_join_body") }}
    </MusicQuizYoureIn>
    <component
      :is="answerComponent"
      v-else
      :state="state"
      :current-round="currentRound"
      :busy="busy"
      @submit="onSubmitAnswer"
    />
    <MusicQuizLeaderboard
      :rows="leaderboardRows"
      :current-player-name="state.you.name"
      compact
    />
  </section>

  <section v-else-if="state.phase === 'finished'" class="flex flex-col gap-4">
    <MusicQuizPodium v-if="leaderboardRows.length" :rows="leaderboardRows" />
    <MusicQuizPersonalStats :stats="personalStats" />
    <MusicQuizLeaderboard
      :rows="leaderboardRows"
      :current-player-name="state.you.name"
    />
  </section>
</template>

<script setup lang="ts">
import MusicQuizAutoStartStatus from "@/components/music-quiz/MusicQuizAutoStartStatus.vue";
import MusicQuizLeaderboard, {
  type MusicQuizLeaderboardRow,
} from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import MusicQuizPersonalStats from "@/components/music-quiz/MusicQuizPersonalStats.vue";
import MusicQuizPodium from "@/components/music-quiz/MusicQuizPodium.vue";
import MusicQuizPreparingState from "@/components/music-quiz/MusicQuizPreparingState.vue";
import MusicQuizTimerBar from "@/components/music-quiz/MusicQuizTimerBar.vue";
import MusicQuizYoureIn from "@/components/music-quiz/MusicQuizYoureIn.vue";
import type {
  MusicQuizAnswerSubmission,
  MusicQuizCurrentRound,
  MusicQuizSupportedPersonalizedState,
} from "@/composables/music-quiz/useMusicQuiz";
import { useMusicQuizAnswerDeadline } from "@/composables/music-quiz/useMusicQuizAnswerDeadline";
import { useMusicQuizPersonalStats } from "@/composables/music-quiz/useMusicQuizPersonalStats";
import { useMusicQuizPhaseScroll } from "@/composables/music-quiz/useMusicQuizPhaseScroll";
import { $t } from "@/plugins/i18n";

import { computed, ref, type Component } from "vue";

const props = defineProps<{
  state: MusicQuizSupportedPersonalizedState;
  currentRound: MusicQuizCurrentRound | null;
  busy: boolean;
  leaderboardRows: MusicQuizLeaderboardRow[];
  gameComponent: Component;
  answerComponent: Component;
  /** This game's player id; tells one game's stats from the next. */
  playerId?: string | null;
}>();
const emit = defineEmits<{
  "submit-answer": [submission: MusicQuizAnswerSubmission];
  ready: [];
}>();

const joinedMidRound = computed(
  () =>
    !!props.currentRound &&
    props.state.you.active_from_round > props.currentRound.round_index,
);
const { stats: personalStats } = useMusicQuizPersonalStats(
  () => props.state,
  () => props.playerId,
);
const answeringSectionRef = ref<HTMLElement | null>(null);
const { remainingLabel, remainingFraction } = useMusicQuizAnswerDeadline({
  active: () => props.state.phase === "answering",
  deadline: () => props.currentRound?.deadline,
  duration: () => props.state.answer_duration,
});
useMusicQuizPhaseScroll({
  phase: () => props.state.phase,
  roundIndex: () => props.currentRound?.round_index ?? null,
  target: answeringSectionRef,
});

function onSubmitAnswer(submission: MusicQuizAnswerSubmission) {
  emit("submit-answer", submission);
}
</script>
