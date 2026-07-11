<template>
  <div class="flex flex-col gap-3">
    <Card v-if="currentRound" class="gap-3 py-4">
      <CardHeader class="px-4">
        <CardTitle class="text-base">
          {{ $t("providers.music_quiz.timeline_progress") }}
        </CardTitle>
        <CardAction>
          <Badge variant="secondary">
            {{
              $t("providers.music_quiz.timeline_entries_count", [
                currentRound.timeline.length,
              ])
            }}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent class="grid grid-cols-2 gap-2 px-4">
        <div class="bg-muted rounded-md px-3 py-2">
          <span class="text-muted-foreground block text-xs">
            {{ $t("providers.music_quiz.timeline_placed") }}
          </span>
          <strong>{{ placedCount }} / {{ state.players.length }}</strong>
        </div>
        <div class="bg-muted rounded-md px-3 py-2">
          <span class="text-muted-foreground block text-xs">
            {{ $t("providers.music_quiz.timeline_finished") }}
          </span>
          <strong>{{ finishedCount }} / {{ state.players.length }}</strong>
        </div>
      </CardContent>
    </Card>

    <Card v-if="state.sources.length > 0" class="gap-0 py-2">
      <Accordion type="single" collapsible>
        <AccordionItem value="sources" class="border-b-0 px-4">
          <AccordionTrigger>
            <span class="flex w-full items-center justify-between gap-3 pr-2">
              {{ $t("providers.music_quiz.selected_music") }}
              <span class="text-muted-foreground text-sm font-normal">
                {{ sourcesSummary }}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div
              class="flex max-h-48 flex-col gap-2 overflow-y-auto overscroll-contain"
            >
              <div
                v-for="source in state.sources"
                :key="source.uri"
                class="bg-background min-w-0 rounded-md border px-3 py-2"
              >
                <strong class="block truncate">{{ source.name }}</strong>
                <small class="text-muted-foreground block truncate">
                  {{ musicQuizSourceTypeLabel(source.media_type) }}
                </small>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  </div>
</template>

<script setup lang="ts">
import type { MusicQuizHostPanelGameAdapterProps } from "@/components/music-quiz/adapter_contracts";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  MusicQuizHitsterHostState,
  MusicQuizTimelineRound,
} from "@/composables/useMusicQuiz";
import {
  getMusicQuizSourceSummary,
  musicQuizSourceTypeLabel,
} from "@/helpers/music_quiz_sources";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const props =
  defineProps<
    MusicQuizHostPanelGameAdapterProps<
      MusicQuizHitsterHostState,
      MusicQuizTimelineRound
    >
  >();

const placedCount = computed(
  () => props.state.players.filter((player) => player.placed).length,
);
const finishedCount = computed(
  () => props.state.players.filter((player) => player.answered).length,
);
const sourcesSummary = computed(() =>
  getMusicQuizSourceSummary(props.state.sources),
);
</script>
