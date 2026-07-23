<template>
  <Card class="gap-0 py-2">
    <div class="flex items-center justify-between gap-3 px-4 py-3">
      <span class="font-medium">
        {{ $t("providers.music_quiz.question_language") }}
      </span>
      <span class="text-muted-foreground text-sm" data-testid="trivia-language">
        {{ languageLabel }}
      </span>
    </div>

    <div
      class="flex items-center justify-between gap-3 border-t px-4 py-3"
      data-testid="trivia-reveal-audio"
    >
      <span class="font-medium">
        {{ $t("providers.music_quiz.play_revealed_songs") }}
      </span>
      <span class="text-muted-foreground text-sm">
        {{
          $t(
            state.play_reveal_audio === true
              ? "providers.music_quiz.reveal_audio_on"
              : "providers.music_quiz.reveal_audio_off",
          )
        }}
      </span>
    </div>

    <Accordion
      v-if="state.sources.length"
      type="multiple"
      :default-value="['sources']"
    >
      <AccordionItem value="sources" class="border-b-0 px-4">
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
import { Card } from "@/components/ui/card";
import type {
  MusicQuizTriviaHostState,
  MusicQuizTriviaRound,
} from "@/composables/music-quiz/useMusicQuiz";
import {
  getMusicQuizSourceSummary,
  musicQuizSourceTypeLabel,
} from "@/helpers/music_quiz_sources";
import { $t, getLocaleDisplayName, i18n } from "@/plugins/i18n";
import { computed } from "vue";

const props =
  defineProps<
    MusicQuizHostPanelGameAdapterProps<
      MusicQuizTriviaHostState,
      MusicQuizTriviaRound
    >
  >();

const sourceSummary = computed(() =>
  getMusicQuizSourceSummary(props.state.sources),
);
const languageLabel = computed(() =>
  getLocaleDisplayName(props.state.language || "en", i18n.global.locale.value),
);
</script>
