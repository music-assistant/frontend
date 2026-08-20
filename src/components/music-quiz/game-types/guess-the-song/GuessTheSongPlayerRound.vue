<template>
  <GuessTheSongReveal
    v-if="state.phase === 'reveal'"
    :round="currentRound"
    :image-url="currentRoundImageUrl"
    @copy-title="copyCurrentRoundTitle"
  />
  <MusicQuizReadyBar
    v-if="state.phase === 'reveal'"
    :disabled="busy || state.you.ready"
    data-testid="guess-the-song-ready"
    @ready="emit('ready')"
  >
    {{ readyLabel }}
  </MusicQuizReadyBar>
</template>

<script setup lang="ts">
import type {
  MusicQuizPlayerGameAdapterEmits,
  MusicQuizPlayerGameAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import MusicQuizReadyBar from "@/components/music-quiz/MusicQuizReadyBar.vue";
import GuessTheSongReveal from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongReveal.vue";
import type {
  MusicQuizGuessTheSongPersonalizedState,
  MusicQuizGuessTheSongRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { copyToClipboard, getMediaImageUrl } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
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
