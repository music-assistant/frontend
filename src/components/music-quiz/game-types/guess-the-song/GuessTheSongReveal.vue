<template>
  <Card class="gap-4 py-4">
    <CardContent class="flex flex-col gap-4 px-4">
      <Button
        v-if="showReadyButton"
        class="w-full max-w-sm self-center"
        size="lg"
        :disabled="busy || isReady"
        @click="emit('ready')"
      >
        <Check class="size-4" />
        {{ readyLabel }}
      </Button>

      <div
        :class="
          showLyrics
            ? 'grid gap-4 lg:grid-cols-[minmax(200px,300px)_minmax(0,1fr)]'
            : 'flex flex-col items-center gap-3'
        "
      >
        <div class="flex min-w-0 flex-col gap-3">
          <img
            v-if="imageUrl"
            :src="imageUrl"
            :alt="round.answer_label"
            class="bg-muted mx-auto aspect-square w-full max-w-72 rounded-lg object-cover"
          />
          <div class="flex items-center justify-center gap-2">
            <h2 class="min-w-0 text-lg font-bold break-words">
              {{ round.answer_label }}
            </h2>
            <Button
              v-if="showCopyButton"
              class="shrink-0"
              :disabled="!round.answer_label"
              size="icon"
              type="button"
              variant="outline"
              :title="$t('providers.music_quiz.copy_music_name')"
              @click="emit('copy-title')"
            >
              <Copy class="size-4" />
            </Button>
          </div>
        </div>

        <div
          v-if="showLyrics"
          class="quiz-reveal__lyrics bg-background rounded-lg border"
        >
          <LyricsViewer
            v-if="hasLyrics"
            :position="lyricsPosition"
            :lyrics="lyrics"
            :lrc-lyrics="lrcLyrics"
            :text-color="lyricsTextColor"
            :anticipation="0"
          />
          <div
            v-else-if="lyricsLoading"
            class="text-muted-foreground flex h-full items-center justify-center gap-2 font-semibold"
          >
            <Loader2 class="size-5 animate-spin" />
            <span>{{ $t("providers.music_quiz.loading_lyrics") }}</span>
          </div>
          <div
            v-else
            class="text-muted-foreground flex h-full items-center justify-center"
          >
            <span>{{ $t("no_lyrics_available") }}</span>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import LyricsViewer from "@/components/LyricsViewer.vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MusicQuizGuessTheSongRound } from "@/composables/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { Check, Copy, Loader2 } from "@lucide/vue";

withDefaults(
  defineProps<{
    round: MusicQuizGuessTheSongRound;
    busy: boolean;
    isReady: boolean;
    readyLabel: string;
    imageUrl: string;
    showLyrics: boolean;
    hasLyrics: boolean;
    lyricsLoading?: boolean;
    lyrics: string;
    lrcLyrics: string;
    lyricsPosition: number;
    lyricsTextColor: string;
    showReadyButton?: boolean;
    showCopyButton?: boolean;
  }>(),
  {
    showReadyButton: true,
    showCopyButton: true,
    lyricsLoading: false,
  },
);
const emit = defineEmits<{ ready: []; "copy-title": [] }>();
</script>

<style scoped>
.quiz-reveal__lyrics {
  height: clamp(220px, 34dvh, 360px);
  min-height: 220px;
  overflow: hidden;
  padding: 0.25rem;
}

.quiz-reveal__lyrics :deep(.lyrics-line) {
  margin: 0.15rem 0;
  padding: 0.35rem 0.2rem;
  font-size: clamp(1.35rem, 6vw, 2.4rem);
  line-height: 1.15;
}

.quiz-reveal__lyrics :deep(.break-note) {
  font-size: clamp(1.35rem, 6vw, 2.4rem);
}

.quiz-reveal__lyrics :deep(.song-title) {
  font-size: clamp(1.25rem, 5vw, 2rem);
}

.quiz-reveal__lyrics :deep(.artist-name) {
  margin-bottom: 1rem;
  font-size: clamp(1rem, 4vw, 1.4rem);
}

@media (min-width: 1024px) {
  .quiz-reveal__lyrics {
    height: clamp(360px, 52dvh, 560px);
  }

  .quiz-reveal__lyrics :deep(.lyrics-line),
  .quiz-reveal__lyrics :deep(.break-note) {
    font-size: clamp(1.65rem, 2.3vw, 2.8rem);
  }

  .quiz-reveal__lyrics :deep(.song-title) {
    font-size: clamp(1.45rem, 2vw, 2.3rem);
  }

  .quiz-reveal__lyrics :deep(.artist-name) {
    font-size: clamp(1.1rem, 1.4vw, 1.55rem);
  }
}
</style>
