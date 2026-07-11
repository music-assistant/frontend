<template>
  <Card class="gap-0 py-2">
    <Accordion type="multiple" :default-value="['settings']">
      <AccordionItem value="settings" class="border-b-0 px-4">
        <AccordionTrigger>
          {{ $t("providers.music_quiz.hitster_session_summary") }}
        </AccordionTrigger>
        <AccordionContent>
          <dl class="grid gap-3 sm:grid-cols-2">
            <div class="bg-background rounded-md border p-3">
              <dt class="text-muted-foreground text-sm">
                {{ $t("providers.music_quiz.timeline_artist_bonus") }}
              </dt>
              <dd class="font-semibold">
                {{ bonusModeLabel(state.artist_bonus_mode) }}
              </dd>
            </div>
            <div class="bg-background rounded-md border p-3">
              <dt class="text-muted-foreground text-sm">
                {{ $t("providers.music_quiz.timeline_title_bonus") }}
              </dt>
              <dd class="font-semibold">
                {{ bonusModeLabel(state.title_bonus_mode) }}
              </dd>
            </div>
          </dl>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem
        v-if="currentRound"
        value="current-round"
        class="border-b-0 px-4"
      >
        <AccordionTrigger>
          {{ $t("providers.music_quiz.now_playing") }}
        </AccordionTrigger>
        <AccordionContent>
          <div
            v-if="state.phase === 'reveal' && currentRound.revealed_entry"
            class="bg-background flex items-center justify-between gap-3 rounded-md border p-3"
          >
            <div class="min-w-0">
              <strong class="block truncate">
                {{ currentRound.revealed_entry.title }}
              </strong>
              <span class="text-muted-foreground block truncate text-sm">
                {{ currentRound.revealed_entry.artist }}
              </span>
            </div>
            <Badge>{{ currentRound.revealed_entry.release_year }}</Badge>
          </div>
          <p v-else class="text-muted-foreground">
            {{ $t("providers.music_quiz.hitster_song_hidden") }}
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem
        v-if="state.sources.length"
        value="sources"
        class="border-b-0 px-4"
      >
        <AccordionTrigger>
          <span class="flex w-full items-center justify-between gap-3 pr-2">
            {{ $t("providers.music_quiz.selected_music") }}
            <span class="text-muted-foreground text-sm font-normal">
              {{ sourceSummary }}
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
import { Card } from "@/components/ui/card";
import type {
  MusicQuizHitsterHostState,
  MusicQuizHitsterRound,
  MusicQuizTimelineBonusMode,
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
      MusicQuizHitsterRound
    >
  >();

const sourceSummary = computed(() =>
  getMusicQuizSourceSummary(props.state.sources),
);

function bonusModeLabel(mode: MusicQuizTimelineBonusMode) {
  if (mode === "free_text")
    return $t("providers.music_quiz.timeline_bonus_free_text");
  if (mode === "multiple_choice")
    return $t("providers.music_quiz.timeline_bonus_multiple_choice");
  return $t("providers.music_quiz.timeline_bonus_off");
}
</script>
