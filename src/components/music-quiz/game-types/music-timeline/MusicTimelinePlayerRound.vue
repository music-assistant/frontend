<template>
  <MusicTimelineRound
    :phase="state.phase"
    :round="currentRound"
    :is-final-round="isFinalRound"
    :busy="busy"
    :is-ready="state.you.ready"
    :ready-label="readyLabel"
    :show-ready-button="true"
    @ready="emit('ready')"
  />
</template>

<script setup lang="ts">
import type {
  MusicQuizPlayerGameAdapterEmits,
  MusicQuizPlayerGameAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import MusicTimelineRound from "@/components/music-quiz/game-types/music-timeline/MusicTimelineRound.vue";
import type {
  MusicQuizTimelinePersonalizedState,
  MusicQuizTimelineRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const props =
  defineProps<
    MusicQuizPlayerGameAdapterProps<
      MusicQuizTimelinePersonalizedState,
      MusicQuizTimelineRound
    >
  >();
const emit = defineEmits<MusicQuizPlayerGameAdapterEmits>();

const isFinalRound = computed(
  () => props.currentRound.round_index + 1 >= props.state.round_count,
);
const readyLabel = computed(() =>
  props.state.you.ready
    ? $t(
        isFinalRound.value
          ? "providers.music_quiz.waiting_for_final_results"
          : "providers.music_quiz.waiting_for_next",
      )
    : $t(
        isFinalRound.value
          ? "providers.music_quiz.ready_for_final_results"
          : "providers.music_quiz.ready",
      ),
);
</script>
