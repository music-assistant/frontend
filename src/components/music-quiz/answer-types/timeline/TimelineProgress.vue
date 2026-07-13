<template>
  <Card class="gap-4 py-4" :class="{ 'min-h-0 overflow-hidden': scrollable }">
    <CardHeader class="px-4">
      <CardTitle class="text-base">
        {{ $t("providers.music_quiz.timeline_progress") }}
      </CardTitle>
      <CardAction class="flex gap-2">
        <Badge variant="outline">
          {{ $t("providers.music_quiz.timeline_placed_count", [placedCount]) }}
        </Badge>
        <Badge variant="secondary">
          {{ completedCount }} / {{ statuses.length }}
        </Badge>
      </CardAction>
    </CardHeader>
    <CardContent
      class="px-4"
      :class="{
        'min-h-0 flex-1 overflow-y-auto overscroll-contain': scrollable,
      }"
    >
      <ul class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
        <li v-for="player in statuses" :key="player.name">
          <MusicQuizPlayerTile :name="player.name">
            <template #trailing>
              <CheckCircle2
                v-if="player.answered"
                class="text-primary size-4 shrink-0"
              />
              <ListChecks
                v-else-if="player.placed"
                class="text-amber-500 size-4 shrink-0"
              />
              <Clock v-else class="text-muted-foreground size-4 shrink-0" />
              <span class="sr-only">{{ statusLabel(player) }}</span>
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
import type { MusicQuizTimelinePlayer } from "@/composables/music-quiz/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { CheckCircle2, Clock, ListChecks } from "@lucide/vue";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    statuses: MusicQuizTimelinePlayer[];
    scrollable?: boolean;
  }>(),
  {
    scrollable: false,
  },
);

const placedCount = computed(
  () => props.statuses.filter((player) => player.placed).length,
);
const completedCount = computed(
  () => props.statuses.filter((player) => player.answered).length,
);

function statusLabel(player: MusicQuizTimelinePlayer) {
  if (player.answered) return $t("providers.music_quiz.timeline_complete");
  if (player.placed) return $t("providers.music_quiz.timeline_bonuses_pending");
  return $t("providers.music_quiz.waiting_for_answer");
}
</script>
