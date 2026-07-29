<template>
  <Card v-if="showNowPlaying || showSources" class="gap-0 py-2">
    <Accordion type="multiple" :default-value="defaultOpenPanels">
      <AccordionItem
        v-if="showNowPlaying"
        value="now-playing"
        class="border-b-0 px-4"
      >
        <AccordionTrigger>
          {{ $t("providers.music_quiz.now_playing") }}
        </AccordionTrigger>
        <AccordionContent>
          <div class="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4">
            <img
              v-if="currentRoundImageUrl"
              :src="currentRoundImageUrl"
              :alt="currentRound?.answer_label"
              class="bg-muted aspect-square w-full rounded-lg object-cover"
            />
            <div class="flex min-w-0 flex-col gap-1">
              <span class="text-muted-foreground text-sm">
                {{ $t("providers.music_quiz.current_music") }}
              </span>
              <strong class="text-xl leading-tight break-words">
                {{ currentRound?.answer_label }}
              </strong>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem v-if="showSources" value="sources" class="border-b-0 px-4">
        <AccordionTrigger>
          <span class="flex w-full items-center justify-between gap-3 pr-2">
            {{ $t("providers.music_quiz.selected_music") }}
            <span class="text-muted-foreground text-sm font-normal">
              {{ sessionSourcesSummary }}
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
import { Card } from "@/components/ui/card";
import type {
  MusicQuizGuessTheSongHostState,
  MusicQuizGuessTheSongRound,
} from "@/composables/music-quiz/useMusicQuiz";
import {
  getMusicQuizSourceSummary,
  musicQuizSourceTypeLabel,
} from "@/helpers/music_quiz_sources";
import { getMediaImageUrl } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const props =
  defineProps<
    MusicQuizHostPanelGameAdapterProps<
      MusicQuizGuessTheSongHostState,
      MusicQuizGuessTheSongRound
    >
  >();

const currentRoundImageUrl = computed(() =>
  getMediaImageUrl(props.currentRound?.image_url ?? ""),
);
const sessionSourcesSummary = computed(() =>
  getMusicQuizSourceSummary(props.state.sources),
);
const showNowPlaying = computed(
  () => props.state.phase !== "finished" && !!props.currentRound,
);
const showSources = computed(() => props.state.sources.length > 0);
const defaultOpenPanels = computed(() =>
  showSources.value ? ["sources"] : [],
);
</script>
