<template>
  <GuessTheSongReveal
    v-if="state.phase === 'reveal'"
    :round="currentRound"
    :image-url="currentRoundImageUrl"
    :show-copy-button="false"
    @copy-title="noop"
  />
</template>

<script setup lang="ts">
import type { MusicQuizPresentGameAdapterProps } from "@/components/music-quiz/adapter_contracts";
import GuessTheSongReveal from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongReveal.vue";
import type {
  MusicQuizGuessTheSongPublicState,
  MusicQuizGuessTheSongRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { getMediaImageUrl } from "@/helpers/utils";
import { computed } from "vue";

const props =
  defineProps<
    MusicQuizPresentGameAdapterProps<
      MusicQuizGuessTheSongPublicState,
      MusicQuizGuessTheSongRound
    >
  >();

const currentRoundImageUrl = computed(() =>
  getMediaImageUrl(props.currentRound.image_url ?? ""),
);

function noop() {
  // Read-only interaction.
}
</script>
