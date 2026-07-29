<template>
  <GuessTheSongReveal
    v-if="state.phase === 'reveal'"
    :round="currentRound"
    :busy="true"
    :is-ready="true"
    :ready-label="$t('providers.music_quiz.ready')"
    :image-url="currentRoundImageUrl"
    :show-lyrics="false"
    :has-lyrics="false"
    :lyrics="''"
    :lrc-lyrics="''"
    :lyrics-position="0"
    lyrics-text-color="var(--foreground)"
    :show-ready-button="false"
    :show-copy-button="false"
    @ready="noop"
    @copy-title="noop"
  />
</template>

<script setup lang="ts">
import type { MusicQuizPresentGameAdapterProps } from "@/components/music-quiz/adapter_contracts";
import GuessTheSongReveal from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongReveal.vue";
import type {
  MusicQuizGuessTheSongHostState,
  MusicQuizGuessTheSongRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { getMediaImageUrl } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const props =
  defineProps<
    MusicQuizPresentGameAdapterProps<
      MusicQuizGuessTheSongHostState,
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
