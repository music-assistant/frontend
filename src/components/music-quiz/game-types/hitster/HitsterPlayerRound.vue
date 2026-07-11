<template>
  <HitsterRound
    :phase="state.phase"
    :round="currentRound"
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
import HitsterRound from "@/components/music-quiz/game-types/hitster/HitsterRound.vue";
import type {
  MusicQuizHitsterPersonalizedState,
  MusicQuizHitsterRound,
} from "@/composables/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const props =
  defineProps<
    MusicQuizPlayerGameAdapterProps<
      MusicQuizHitsterPersonalizedState,
      MusicQuizHitsterRound
    >
  >();
const emit = defineEmits<MusicQuizPlayerGameAdapterEmits>();

const readyLabel = computed(() =>
  props.state.you.ready
    ? $t("providers.music_quiz.waiting_for_next")
    : $t("providers.music_quiz.ready"),
);
</script>
