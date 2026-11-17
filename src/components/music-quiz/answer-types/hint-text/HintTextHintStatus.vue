<template>
  <div class="flex w-full max-w-md flex-col items-center gap-2">
    <Progress
      :model-value="hintPercent"
      :aria-label="hintLabel"
      class="w-full"
    />
    <p class="text-muted-foreground text-center text-sm">
      {{ hintLabel }} · {{ typoLabel }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { Progress } from "@/components/ui/progress";
import type { MusicQuizHintTextRound } from "@/composables/music-quiz/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const FULL_PERCENT = 100;

const props = defineProps<{
  round: MusicQuizHintTextRound;
}>();

const hintPercent = computed(() =>
  props.round.hint_count
    ? (props.round.revealed_count / props.round.hint_count) * FULL_PERCENT
    : 0,
);
const hintLabel = computed(() =>
  $t("providers.music_quiz.title_reveal_hints_progress", [
    props.round.revealed_count,
    props.round.hint_count,
  ]),
);
const typoLabel = computed(() =>
  props.round.allowed_typos
    ? $t("providers.music_quiz.title_reveal_typos_allowed", [
        props.round.allowed_typos,
      ])
    : $t("providers.music_quiz.title_reveal_exact_spelling"),
);
</script>
