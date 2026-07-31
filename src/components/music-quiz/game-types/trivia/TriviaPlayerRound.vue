<template>
  <TriviaQuestion :round="currentRound" />
  <Button
    v-if="state.phase === 'reveal'"
    size="lg"
    :disabled="readyDisabled"
    data-testid="trivia-ready"
    @click="markReady"
  >
    <Check class="size-4" />
    {{ readyLabel }}
  </Button>
</template>

<script setup lang="ts">
import type {
  MusicQuizPlayerGameAdapterEmits,
  MusicQuizPlayerGameAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import TriviaQuestion from "@/components/music-quiz/game-types/trivia/TriviaQuestion.vue";
import { Button } from "@/components/ui/button";
import type {
  MusicQuizTriviaPersonalizedState,
  MusicQuizTriviaRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { useMusicQuizRevealCountdown } from "@/composables/music-quiz/useMusicQuizRevealCountdown";
import { $t } from "@/plugins/i18n";
import { Check } from "@lucide/vue";
import { computed, ref, watch } from "vue";

const props =
  defineProps<
    MusicQuizPlayerGameAdapterProps<
      MusicQuizTriviaPersonalizedState,
      MusicQuizTriviaRound
    >
  >();
const emit = defineEmits<MusicQuizPlayerGameAdapterEmits>();

const isFinalRound = computed(
  () => props.currentRound.round_index + 1 >= props.state.round_count,
);
const { hasElapsed, isScheduled, remainingLabel } = useMusicQuizRevealCountdown(
  {
    active: () => props.state.phase === "reveal",
    autoAdvanceAt: () => props.currentRound.auto_advance_at,
  },
);
const readyRequested = ref(false);
const readyDisabled = computed(
  () => props.busy || props.state.you.ready || readyRequested.value,
);
const readyLabel = computed(() => {
  if (isScheduled.value && !hasElapsed.value) {
    return $t(
      props.state.you.ready
        ? isFinalRound.value
          ? "providers.music_quiz.waiting_for_final_results_countdown"
          : "providers.music_quiz.waiting_for_next_round_countdown"
        : isFinalRound.value
          ? "providers.music_quiz.ready_for_final_results_countdown"
          : "providers.music_quiz.ready_for_next_round_countdown",
      [remainingLabel.value],
    );
  }

  return $t(
    props.state.you.ready
      ? isFinalRound.value
        ? "providers.music_quiz.waiting_for_final_results"
        : "providers.music_quiz.waiting_for_next"
      : isFinalRound.value
        ? "providers.music_quiz.ready_for_final_results"
        : "providers.music_quiz.ready",
  );
});

watch(
  () => props.currentRound.round_index,
  () => {
    readyRequested.value = false;
  },
);
watch(
  () => props.busy,
  (busy, wasBusy) => {
    if (wasBusy && !busy && !props.state.you.ready) {
      readyRequested.value = false;
    }
  },
);

function markReady() {
  if (readyDisabled.value) return;
  readyRequested.value = true;
  emit("ready");
}
</script>
