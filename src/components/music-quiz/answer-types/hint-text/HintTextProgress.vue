<template>
  <Card class="gap-4 py-4" :class="{ 'min-h-0 overflow-hidden': scrollable }">
    <CardHeader class="px-4">
      <CardTitle class="text-base">
        {{ $t("providers.music_quiz.title_reveal_solved_players") }}
      </CardTitle>
      <CardAction>
        <Badge>{{ solvedCount }} / {{ statuses.length }}</Badge>
      </CardAction>
    </CardHeader>
    <CardContent
      class="px-4"
      :class="{
        'min-h-0 flex-1 overflow-y-auto overscroll-contain': scrollable,
      }"
    >
      <ul
        class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 p-0"
      >
        <li v-for="player in orderedStatuses" :key="player.name">
          <MusicQuizPlayerTile :name="player.name">
            <template #trailing>
              <Badge v-if="player.solved_rank !== null" variant="secondary">
                #{{ player.solved_rank }}
              </Badge>
              <Clock v-else class="text-muted-foreground size-4 shrink-0" />
              <span class="sr-only">
                {{
                  player.solved_rank !== null
                    ? $t("providers.music_quiz.title_reveal_solved")
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
import type { MusicQuizHintTextPlayer } from "@/composables/music-quiz/useMusicQuiz";
import { getHintTextSolvers } from "@/helpers/music_quiz_hint_text";
import { $t } from "@/plugins/i18n";
import { Clock } from "@lucide/vue";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    statuses: MusicQuizHintTextPlayer[];
    scrollable?: boolean;
  }>(),
  { scrollable: false },
);

const solvers = computed(() => getHintTextSolvers(props.statuses));
const solvedCount = computed(() => solvers.value.length);
const orderedStatuses = computed(() => [
  ...solvers.value,
  ...props.statuses.filter((player) => player.solved_rank === null),
]);
</script>
