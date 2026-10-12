<template>
  <GuessTheSongReveal
    v-if="state.phase === 'reveal'"
    :round="currentRound"
    :image-url="currentRoundImageUrl"
    @copy-title="copyCurrentRoundTitle"
  />
</template>

<script setup lang="ts">
import type { MusicQuizHostGameAdapterProps } from "@/components/music-quiz/adapter_contracts";
import GuessTheSongReveal from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongReveal.vue";
import type {
  MusicQuizGuessTheSongHostState,
  MusicQuizGuessTheSongRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { copyToClipboard, getMediaImageUrl } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";
import { toast } from "vue-sonner";

const props =
  defineProps<
    MusicQuizHostGameAdapterProps<
      MusicQuizGuessTheSongHostState,
      MusicQuizGuessTheSongRound
    >
  >();

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
