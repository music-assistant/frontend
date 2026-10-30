<template>
  <Card
    class="gap-2 px-4 py-3"
    role="region"
    :aria-label="$t('providers.music_quiz.personal_title')"
    data-testid="personal-stats"
  >
    <h2 class="text-base font-semibold">
      {{ $t("providers.music_quiz.personal_title") }}
    </h2>
    <dl class="grid grid-cols-2 gap-3">
      <div class="flex flex-col">
        <dt class="text-muted-foreground flex items-center gap-1.5 text-sm">
          <Target class="size-4 text-green-500" aria-hidden="true" />
          {{ $t("providers.music_quiz.personal_correct") }}
        </dt>
        <dd class="text-2xl font-bold tabular-nums">
          {{ stats.correct }}/{{ stats.rounds }}
        </dd>
      </div>
      <div class="flex flex-col">
        <dt class="text-muted-foreground flex items-center gap-1.5 text-sm">
          <Zap class="size-4 text-yellow-400" aria-hidden="true" />
          {{ $t("providers.music_quiz.award_fastest") }}
        </dt>
        <dd class="text-2xl font-bold tabular-nums">
          {{
            stats.fastestSeconds === null
              ? "–"
              : formatAnswerSeconds(stats.fastestSeconds)
          }}
        </dd>
      </div>
    </dl>
  </Card>
</template>

<script setup lang="ts">
import { Card } from "@/components/ui/card";
import {
  formatAnswerSeconds,
  type MusicQuizPersonalStats,
} from "@/helpers/music_quiz_stats";
import { $t } from "@/plugins/i18n";
import { Target, Zap } from "@lucide/vue";

defineProps<{ stats: MusicQuizPersonalStats }>();
</script>
