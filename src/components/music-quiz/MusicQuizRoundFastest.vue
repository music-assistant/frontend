<template>
  <p
    class="bg-primary/10 text-foreground mx-auto flex w-fit items-center gap-2 rounded-full px-4 py-2 font-semibold"
    role="status"
    data-testid="round-fastest"
  >
    <Zap class="size-4 shrink-0 text-yellow-400" aria-hidden="true" />
    <span>{{
      $t("providers.music_quiz.stats_round_fastest", [fastest.name])
    }}</span>
    <span v-if="fastest.seconds !== null" class="text-primary tabular-nums">
      {{ formatAnswerSeconds(fastest.seconds) }}
    </span>
  </p>
</template>

<script setup lang="ts">
import {
  formatAnswerSeconds,
  type MusicQuizFastestAnswer,
} from "@/helpers/music_quiz_stats";
import { $t } from "@/plugins/i18n";
import { Zap } from "@lucide/vue";

defineProps<{ fastest: MusicQuizFastestAnswer }>();
</script>
