<template>
  <div
    v-if="outcome"
    class="animate-in fade-in zoom-in-95 flex flex-col items-center gap-1 rounded-xl px-4 py-5 text-center duration-300 motion-reduce:animate-none"
    :class="TONES[outcome]"
    role="status"
    data-testid="round-result-banner"
  >
    <component :is="ICONS[outcome]" class="mb-1 size-12" aria-hidden="true" />
    <h2 class="text-2xl font-extrabold">{{ title }}</h2>
    <p v-if="detail" class="text-foreground text-base font-semibold">
      {{ detail }}
    </p>
    <ul
      v-if="results.length > 1"
      class="mt-2 flex list-none flex-wrap justify-center gap-2"
    >
      <li
        v-for="result in results"
        :key="result.key"
        class="bg-background/60 text-foreground flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold"
      >
        <CircleCheck
          v-if="result.correct"
          class="size-4 text-green-600 dark:text-green-400"
          aria-hidden="true"
        />
        <CircleX v-else class="text-destructive size-4" aria-hidden="true" />
        <span class="sr-only">
          {{
            $t(
              result.correct
                ? "providers.music_quiz.correct"
                : "providers.music_quiz.incorrect",
            )
          }}
        </span>
        {{ result.label }}
        <span>+{{ result.points }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { MusicQuizRoundResult } from "@/components/music-quiz/MusicQuizPlayerHeader.vue";
import { $t } from "@/plugins/i18n";
import { CircleCheck, CircleX, TimerOff } from "@lucide/vue";
import { computed, type Component } from "vue";

type Outcome = "correct" | "incorrect" | "missed";

const TONES: Record<Outcome, string> = {
  correct: "bg-green-500/15 text-green-600 dark:text-green-400",
  incorrect: "bg-red-500/10 text-destructive",
  missed: "bg-muted text-muted-foreground",
};
const ICONS: Record<Outcome, Component> = {
  correct: CircleCheck,
  incorrect: CircleX,
  missed: TimerOff,
};

const props = defineProps<{
  results: MusicQuizRoundResult[];
  answered: boolean;
}>();

const points = computed(() =>
  props.results.reduce((total, result) => total + result.points, 0),
);

// The first result is the main answer; any after it are bonuses.
const outcome = computed<Outcome | null>(() => {
  if (!props.answered) return "missed";
  const main = props.results[0];
  if (!main) return null;
  return main.correct ? "correct" : "incorrect";
});

const title = computed(() => {
  switch (outcome.value) {
    case "correct":
      return $t("providers.music_quiz.correct");
    case "incorrect":
      return $t("providers.music_quiz.result_not_this_time");
    default:
      return $t("providers.music_quiz.result_times_up");
  }
});

const detail = computed(() => {
  if (outcome.value === "missed") {
    return $t("providers.music_quiz.result_missed_detail");
  }
  return points.value > 0
    ? $t("providers.music_quiz.result_points", [points.value])
    : "";
});
</script>
