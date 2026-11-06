<template>
  <section
    class="flex flex-col gap-3"
    :aria-label="$t('providers.music_quiz.stats_title')"
    data-testid="game-awards"
  >
    <h2 class="text-base font-semibold">
      {{ $t("providers.music_quiz.stats_title") }}
    </h2>
    <ul
      class="list-none grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3"
    >
      <li v-for="award in awards" :key="award.kind">
        <Card class="h-full gap-1 px-4 py-3">
          <span
            class="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase"
          >
            <component
              :is="AWARDS[award.kind].icon"
              class="size-4 shrink-0"
              :class="AWARDS[award.kind].tone"
              aria-hidden="true"
            />
            {{ $t(AWARDS[award.kind].labelKey) }}
          </span>
          <strong class="truncate text-lg">{{
            formatNameList(award.names)
          }}</strong>
          <span class="text-primary text-sm font-semibold tabular-nums">
            {{ valueText(award) }}
          </span>
        </Card>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { Card } from "@/components/ui/card";
import { formatNameList } from "@/helpers/music_quiz";
import {
  formatAnswerSeconds,
  type MusicQuizAward,
  type MusicQuizAwardKind,
} from "@/helpers/music_quiz_stats";
import { $t } from "@/plugins/i18n";
import { Flame, Hourglass, Target, Zap } from "@lucide/vue";
import type { Component } from "vue";

defineProps<{ awards: MusicQuizAward[] }>();

const AWARDS: Record<
  MusicQuizAwardKind,
  { icon: Component; tone: string; labelKey: string }
> = {
  fastest: {
    icon: Zap,
    tone: "text-yellow-400",
    labelKey: "providers.music_quiz.award_fastest",
  },
  most_correct: {
    icon: Target,
    tone: "text-green-500",
    labelKey: "providers.music_quiz.award_most_correct",
  },
  streak: {
    icon: Flame,
    tone: "text-orange-500",
    labelKey: "providers.music_quiz.award_streak",
  },
  closest_call: {
    icon: Hourglass,
    tone: "text-primary",
    labelKey: "providers.music_quiz.award_closest_call",
  },
};

function valueText(award: MusicQuizAward): string {
  switch (award.kind) {
    case "fastest":
      return formatAnswerSeconds(award.value);
    case "most_correct":
      return $t("providers.music_quiz.award_correct_count", [award.value]);
    case "streak":
      return $t("providers.music_quiz.award_streak_count", [award.value]);
    case "closest_call":
      return $t("providers.music_quiz.award_spare", [
        formatAnswerSeconds(award.value),
      ]);
  }
}
</script>
