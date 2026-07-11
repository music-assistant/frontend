<template>
  <Card v-if="state.phase === 'answering'" class="gap-4 py-4">
    <CardContent class="flex flex-col items-center gap-3 px-4">
      <MusicQuizCountdown
        :size="120"
        :fraction="remainingFraction"
        :label="remainingLabel || '...'"
      />
      <p class="text-muted-foreground text-center">
        {{ $t("providers.music_quiz.timeline_current_hidden") }}
      </p>
    </CardContent>
  </Card>

  <div
    v-if="state.phase === 'answering' || state.phase === 'reveal'"
    class="grid gap-4 lg:grid-cols-2"
  >
    <TimelineProgress :statuses="sortedPlayers" />
    <slot name="leaderboard" />
  </div>
</template>

<script setup lang="ts">
import TimelineProgress from "@/components/music-quiz/answer-types/timeline/TimelineProgress.vue";
import type {
  MusicQuizAnswerAdapterSlots,
  MusicQuizHostAnswerAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import MusicQuizCountdown from "@/components/music-quiz/MusicQuizCountdown.vue";
import { Card, CardContent } from "@/components/ui/card";
import type {
  MusicQuizHitsterHostState,
  MusicQuizTimelineRound,
} from "@/composables/useMusicQuiz";
import { useMusicQuizAnswerDeadline } from "@/composables/useMusicQuizAnswerDeadline";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const props =
  defineProps<
    MusicQuizHostAnswerAdapterProps<
      MusicQuizHitsterHostState,
      MusicQuizTimelineRound
    >
  >();
defineSlots<MusicQuizAnswerAdapterSlots>();

const sortedPlayers = computed(() =>
  [...props.state.players].sort((a, b) => a.name.localeCompare(b.name)),
);
const { remainingLabel, remainingFraction } = useMusicQuizAnswerDeadline({
  active: () => props.state.phase === "answering",
  deadline: () => props.currentRound.deadline,
  duration: () => props.state.answer_duration,
});
</script>
