<template>
  <Card>
    <CardContent
      class="flex min-h-40 flex-col items-center justify-center gap-5 text-center sm:min-h-52"
      :class="{ 'lg:min-h-72': present }"
    >
      <p
        class="max-w-4xl text-xl leading-snug font-bold text-balance sm:text-2xl"
        :class="{ 'lg:text-4xl': present }"
        data-testid="trivia-question"
      >
        {{ round.question }}
      </p>
      <div
        v-if="round.answer_label"
        class="border-primary/30 bg-primary/10 flex max-w-3xl flex-col gap-1 rounded-xl border px-5 py-3"
      >
        <span class="text-muted-foreground text-sm font-medium">
          {{ $t("providers.music_quiz.answer_was") }}
        </span>
        <strong
          class="text-primary text-xl leading-tight sm:text-2xl"
          :class="{ 'lg:text-3xl': present }"
          data-testid="trivia-answer"
        >
          {{ round.answer_label }}
        </strong>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Card, CardContent } from "@/components/ui/card";
import type { MusicQuizTriviaRound } from "@/composables/music-quiz/useMusicQuiz";
import { $t } from "@/plugins/i18n";

withDefaults(
  defineProps<{
    round: MusicQuizTriviaRound;
    present?: boolean;
  }>(),
  {
    present: false,
  },
);
</script>
