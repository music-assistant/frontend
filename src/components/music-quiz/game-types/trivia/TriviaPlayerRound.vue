<template>
  <TriviaQuestion :phase="state.phase" :round="currentRound" />
  <Button
    v-if="state.phase === 'reveal'"
    size="lg"
    :disabled="busy || state.you.ready"
    @click="emit('ready')"
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
} from "@/composables/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { Check } from "@lucide/vue";
import { computed } from "vue";

const props =
  defineProps<
    MusicQuizPlayerGameAdapterProps<
      MusicQuizTriviaPersonalizedState,
      MusicQuizTriviaRound
    >
  >();
const emit = defineEmits<MusicQuizPlayerGameAdapterEmits>();

const readyLabel = computed(() =>
  props.state.you.ready
    ? $t("providers.music_quiz.waiting_for_next")
    : $t("providers.music_quiz.ready"),
);
</script>
