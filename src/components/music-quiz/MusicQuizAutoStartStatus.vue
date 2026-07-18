<template>
  <p
    v-if="isScheduled && remainingSeconds !== null"
    data-testid="music-quiz-auto-start"
    role="timer"
  >
    {{
      hasElapsed
        ? $t("providers.music_quiz.waiting_for_game_start")
        : $t("providers.music_quiz.game_starts_in", [remainingLabel])
    }}
  </p>
</template>

<script setup lang="ts">
import {
  useMusicQuizAutoStart,
  type MusicQuizAutoStartState,
} from "@/composables/useMusicQuizAutoStart";
import { $t } from "@/plugins/i18n";

const props = defineProps<{
  state: MusicQuizAutoStartState;
}>();

const { hasElapsed, isScheduled, remainingLabel, remainingSeconds } =
  useMusicQuizAutoStart(() => props.state);
</script>
