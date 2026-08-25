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
      :disabled="busy || state.you.ready"
      data-testid="guess-the-song-ready"
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
import GuessTheSongReveal from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongReveal.vue";
import type {
  MusicQuizGuessTheSongPersonalizedState,
  MusicQuizGuessTheSongRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { copyToClipboard, getMediaImageUrl } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import { Check } from "@lucide/vue";
import { computed } from "vue";
import { toast } from "vue-sonner";

const props =
  defineProps<
    MusicQuizPlayerGameAdapterProps<
      MusicQuizGuessTheSongPersonalizedState,
      MusicQuizGuessTheSongRound
    >
  >();
const emit = defineEmits<MusicQuizPlayerGameAdapterEmits>();

const readyLabel = computed(() =>
  props.state.you.ready
    ? $t("providers.music_quiz.waiting_for_next")
    : $t("providers.music_quiz.ready"),
);
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
