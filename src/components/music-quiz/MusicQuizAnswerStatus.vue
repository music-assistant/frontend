<template>
  <Card class="gap-4 py-4">
    <CardHeader class="px-4">
      <CardTitle class="text-base">
        {{ $t("providers.music_quiz.answers") }}
      </CardTitle>
      <CardAction>
        <Badge variant="secondary"
          >{{ answeredCount }} / {{ statuses.length }}</Badge
        >
      </CardAction>
    </CardHeader>
    <CardContent class="px-4">
      <ul class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
        <li v-for="player in statuses" :key="player.name">
          <MusicQuizPlayerTile :name="player.name">
            <template #trailing>
              <Check
                v-if="player.answered"
                class="text-primary size-4 shrink-0"
              />
              <Clock v-else class="text-muted-foreground size-4 shrink-0" />
              <span class="sr-only">
                {{
                  player.answered
                    ? $t("providers.music_quiz.answered")
                    : $t("providers.music_quiz.waiting_for_answer")
                }}
              </span>
            </template>
          </MusicQuizPlayerTile>
        </li>
      </ul>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import MusicQuizPlayerTile from "@/components/music-quiz/MusicQuizPlayerTile.vue";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MusicQuizPlayer } from "@/composables/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { Check, Clock } from "@lucide/vue";

defineProps<{
  statuses: MusicQuizPlayer[];
  answeredCount: number;
}>();
</script>
