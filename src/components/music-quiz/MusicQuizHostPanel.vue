<template>
  <div class="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
    <MusicQuizQrCard
      class="lg:w-72"
      :join-link="joinLink"
      :caption="$t('providers.music_quiz.invite_players')"
    />

    <div class="flex flex-col gap-4">
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
              <div
                class="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4"
              >
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

          <AccordionItem
            v-if="showSources"
            value="sources"
            class="border-b-0 px-4"
          >
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
                  v-for="source in state.sources ?? []"
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

      <div v-if="showActions" class="flex flex-wrap justify-end gap-2">
        <Button
          :disabled="busy"
          type="button"
          variant="outline"
          @click="emit('delete')"
        >
          <Trash2 class="size-4" />
          {{ $t("delete") }}
        </Button>
        <Button
          v-if="state.phase === 'lobby'"
          :disabled="busy"
          @click="emit('start')"
        >
          <Play class="size-4" />
          {{ $t("providers.music_quiz.start") }}
        </Button>
        <Button
          v-if="state.phase === 'answering'"
          :disabled="busy"
          @click="emit('reveal')"
        >
          <Eye class="size-4" />
          {{ $t("providers.music_quiz.phase_reveal") }}
        </Button>
        <Button
          v-if="state.phase === 'reveal'"
          :disabled="busy"
          @click="emit('next')"
        >
          <SkipForward class="size-4" />
          {{
            isLastRound
              ? $t("providers.music_quiz.finish")
              : $t("providers.music_quiz.next")
          }}
        </Button>
        <Button
          v-if="state.phase === 'finished'"
          :disabled="busy"
          @click="emit('reset')"
        >
          <RotateCcw class="size-4" />
          {{ $t("providers.music_quiz.new_game") }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MusicQuizQrCard from "@/components/music-quiz/MusicQuizQrCard.vue";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  MusicQuizHostState,
  MusicQuizRound,
} from "@/composables/useMusicQuiz";
import {
  getMusicQuizSourceSummary,
  musicQuizSourceTypeLabel,
} from "@/helpers/music_quiz_sources";
import { getMediaImageUrl } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import { Eye, Play, RotateCcw, SkipForward, Trash2 } from "@lucide/vue";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    state: MusicQuizHostState;
    busy: boolean;
    joinLink: string;
    currentRound: MusicQuizRound | null;
    isLastRound: boolean;
    showActions?: boolean;
  }>(),
  {
    showActions: true,
  },
);
const emit = defineEmits<{
  delete: [];
  start: [];
  reveal: [];
  next: [];
  reset: [];
}>();

const currentRoundImageUrl = computed(() =>
  getMediaImageUrl(props.currentRound?.image_url ?? ""),
);
const sessionSourcesSummary = computed(() =>
  getMusicQuizSourceSummary(props.state.sources ?? []),
);
const showNowPlaying = computed(
  () => props.state.phase !== "finished" && !!props.currentRound,
);
const showSources = computed(() => (props.state.sources?.length ?? 0) > 0);
const defaultOpenPanels = computed(() =>
  showSources.value ? ["sources"] : [],
);
</script>
