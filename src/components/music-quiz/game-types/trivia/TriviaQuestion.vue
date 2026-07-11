<template>
  <Card>
    <CardHeader class="gap-3">
      <Badge variant="secondary" class="w-fit">
        {{ $t("providers.music_quiz.trivia_question") }}
      </Badge>
      <h2
        class="text-balance font-black"
        :class="
          prominent
            ? 'text-3xl sm:text-4xl lg:text-5xl'
            : 'text-2xl sm:text-3xl'
        "
      >
        {{ round.question }}
      </h2>
    </CardHeader>
    <CardContent
      v-if="phase === 'reveal' && round.answer_label"
      class="border-primary/20 bg-primary/5 mx-4 mb-4 rounded-xl border p-4 sm:p-5"
      role="status"
      aria-live="polite"
    >
      <p class="text-muted-foreground text-sm font-medium">
        {{ $t("providers.music_quiz.answer_was") }}
      </p>
      <p
        class="text-primary mt-1 text-balance font-black"
        :class="prominent ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'"
      >
        {{ round.answer_label }}
      </p>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type {
  MusicQuizPhase,
  MusicQuizTriviaRound,
} from "@/composables/useMusicQuiz";
import { $t } from "@/plugins/i18n";

withDefaults(
  defineProps<{
    phase: MusicQuizPhase;
    round: MusicQuizTriviaRound;
    prominent?: boolean;
  }>(),
  {
    prominent: false,
  },
);
</script>
