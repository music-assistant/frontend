<template>
  <!-- The landing screen explains the game; players see this card only on reveal -->
  <MusicTimelineRound
    v-if="state.phase === 'reveal'"
    :phase="state.phase"
    :round="currentRound"
    :is-final-round="isFinalRound"
  />
  <!-- order-last + sticky only work as a direct child of the stage's flex section -->
  <div
    v-if="state.phase === 'reveal'"
    class="bg-background sticky bottom-[var(--device-inset-bottom,0px)] order-last z-10 flex justify-center pt-2 pb-1"
  >
    <Button
      class="w-full max-w-sm"
      size="lg"
      :disabled="busy || state.you.ready"
      data-testid="music-timeline-ready"
      @click="emit('ready')"
    >
      <Check class="size-4" />
      {{ readyLabel }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import type {
  MusicQuizPlayerGameAdapterEmits,
  MusicQuizPlayerGameAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import { Button } from "@/components/ui/button";
import MusicTimelineRound from "@/components/music-quiz/game-types/music-timeline/MusicTimelineRound.vue";
import type {
  MusicQuizTimelinePersonalizedState,
  MusicQuizTimelineRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { Check } from "@lucide/vue";
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
