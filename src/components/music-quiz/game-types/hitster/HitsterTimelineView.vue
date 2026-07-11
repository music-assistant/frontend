<template>
  <Card class="min-h-0 gap-4 py-4">
    <CardHeader class="px-4">
      <CardTitle :class="presentation ? 'text-2xl sm:text-3xl' : 'text-lg'">
        {{ $t("providers.music_quiz.timeline") }}
      </CardTitle>
      <CardDescription>
        {{
          revealedEntry
            ? $t("providers.music_quiz.timeline_revealed_description")
            : $t("providers.music_quiz.timeline_answering_description")
        }}
      </CardDescription>
      <CardAction>
        <Badge variant="secondary">
          {{
            $t("providers.music_quiz.timeline_entries_count", [
              round.timeline.length,
            ])
          }}
        </Badge>
      </CardAction>
    </CardHeader>

    <CardContent class="flex min-h-0 flex-col gap-4 px-4">
      <div
        v-if="revealedEntry"
        class="bg-primary/10 border-primary/30 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3"
        role="status"
      >
        <Sparkles class="text-primary size-5 shrink-0" />
        <span class="min-w-0 flex-1">
          <strong class="block break-words">{{ revealedEntry.title }}</strong>
          <span class="text-muted-foreground block break-words">
            {{ revealedEntry.artist }} - {{ revealedEntry.release_year }}
          </span>
        </span>
      </div>
      <div
        v-else
        class="bg-muted text-muted-foreground flex items-center gap-3 rounded-lg px-4 py-3"
      >
        <Disc3 class="size-5 shrink-0" aria-hidden="true" />
        <span>{{ $t("providers.music_quiz.timeline_current_hidden") }}</span>
      </div>

      <TimelineBoard
        :timeline="round.timeline"
        :highlight-entry-id="revealedEntry?.entry_id ?? null"
      />
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import TimelineBoard from "@/components/music-quiz/answer-types/timeline/TimelineBoard.vue";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MusicQuizTimelineRound } from "@/composables/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { Disc3, Sparkles } from "@lucide/vue";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    round: MusicQuizTimelineRound;
    presentation?: boolean;
  }>(),
  {
    presentation: false,
  },
);

const revealedEntry = computed(() =>
  "revealed_entry" in props.round ? props.round.revealed_entry : null,
);
</script>
