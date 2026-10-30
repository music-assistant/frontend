<template>
  <GuessTheSongReveal
    v-if="state.phase === 'reveal'"
    :round="currentRound"
    :image-url="currentRoundImageUrl"
    @copy-title="copyCurrentRoundTitle"
  />
  <!-- order-last + sticky only work as a direct child of the stage's flex section -->
  <div
    v-if="state.phase === 'reveal'"
    class="bg-background sticky bottom-[var(--device-inset-bottom,0px)] order-last z-10 flex justify-center pt-2 pb-1"
  >
    <Button
      class="w-full max-w-sm"
      size="lg"
      :disabled="busy || isReady"
      data-testid="guess-the-song-ready"
      @click="markReady"
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
import GuessTheSongReveal from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongReveal.vue";
import type {
  MusicQuizGuessTheSongPersonalizedState,
  MusicQuizGuessTheSongRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { copyToClipboard, getMediaImageUrl } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import { Check } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";

const props =
  defineProps<
    MusicQuizPlayerGameAdapterProps<
      MusicQuizGuessTheSongPersonalizedState,
      MusicQuizGuessTheSongRound
    >
  >();
const emit = defineEmits<MusicQuizPlayerGameAdapterEmits>();

const isFinalRound = computed(
  () => props.currentRound.round_index + 1 >= props.state.round_count,
);
// The server takes a few seconds to confirm; show the tap straight away.
const readyRequested = ref(false);
const isReady = computed(() => props.state.you.ready || readyRequested.value);
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
  if (props.busy || isReady.value) return;
  readyRequested.value = true;
  emit("ready");
}

const readyLabel = computed(() => {
  if (isReady.value) {
    return isFinalRound.value
      ? $t("providers.music_quiz.waiting_for_final_results")
      : $t("providers.music_quiz.waiting_for_next");
  }
  return isFinalRound.value
    ? $t("providers.music_quiz.ready_last_round")
    : $t("providers.music_quiz.ready");
});
const currentRoundImageUrl = computed(() =>
  getMediaImageUrl(props.currentRound.image_url ?? ""),
);

async function copyCurrentRoundTitle() {
  if (!props.currentRound.answer_label) return;
  const copied = await copyToClipboard(props.currentRound.answer_label);
  if (!copied) {
    toast.error($t("providers.music_quiz.copy_music_name_failed"));
  }
}
</script>
