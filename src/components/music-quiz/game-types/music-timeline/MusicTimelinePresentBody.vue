<template>
  <div
    data-testid="music-timeline-present-body"
    class="flex min-h-0 flex-col gap-3 lg:grid lg:flex-1 lg:grid-cols-[minmax(16rem,2fr)_minmax(22rem,3fr)] lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-4 lg:overflow-hidden"
  >
    <MusicTimelinePresentRound
      class="lg:self-start"
      :state="state"
      :current-round="currentRound"
      compact
    />

    <TimelineAudienceAnswer
      class="lg:h-full"
      :state="state"
      :current-round="currentRound"
      :show-timeline="false"
      present
    >
      <template #leaderboard>
        <MusicQuizLeaderboard
          class="lg:h-full"
          :rows="leaderboardRows"
          scrollable
        />
      </template>
    </TimelineAudienceAnswer>

    <TimelineDisplay
      data-testid="music-timeline-history"
      class="lg:col-span-2"
      :entries="currentRound.timeline"
      :highlighted-entry-id="currentRound.revealed_entry?.entry_id"
      horizontal
      compact
    />
  </div>
</template>

<script setup lang="ts">
import TimelineAudienceAnswer from "@/components/music-quiz/answer-types/timeline/TimelineAudienceAnswer.vue";
import TimelineDisplay from "@/components/music-quiz/answer-types/timeline/TimelineDisplay.vue";
import type { MusicQuizPresentBodyAdapterProps } from "@/components/music-quiz/adapter_contracts";
import MusicTimelinePresentRound from "@/components/music-quiz/game-types/music-timeline/MusicTimelinePresentRound.vue";
import MusicQuizLeaderboard from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import type {
  MusicQuizTimelineHostState,
  MusicQuizTimelineRound,
} from "@/composables/music-quiz/useMusicQuiz";

defineProps<
  MusicQuizPresentBodyAdapterProps<
    MusicQuizTimelineHostState,
    MusicQuizTimelineRound
  >
>();
</script>
