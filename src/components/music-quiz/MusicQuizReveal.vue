<template>
  <section
    class="quiz-reveal"
    :class="{ 'quiz-reveal--with-lyrics': showLyrics }"
  >
    <Button
      v-if="showReadyButton"
      :disabled="busy || isReady"
      @click="emit('ready')"
    >
      <Check class="size-4" />
      {{ readyLabel }}
    </Button>
    <div class="quiz-reveal__track">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="round.answer_label"
        class="quiz-reveal__cover"
      />
      <div class="quiz-reveal__title">
        <h2>{{ round.answer_label }}</h2>
        <Button
          v-if="showCopyButton"
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
    <div v-if="showLyrics" class="quiz-reveal__lyrics">
      <LyricsViewer
        v-if="hasLyrics"
        :position="lyricsPosition"
        :lyrics="lyrics"
        :lrc-lyrics="lrcLyrics"
        :text-color="lyricsTextColor"
        :anticipation="0"
      />
      <div v-else class="quiz-reveal__lyrics-loading">
        <Loader2 class="size-5 animate-spin" />
        <span>{{ $t("providers.music_quiz.loading_lyrics") }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import LyricsViewer from "@/components/LyricsViewer.vue";
import { Button } from "@/components/ui/button";
import type { MusicQuizCurrentRound } from "@/composables/useMusicQuiz";
import { Check, Copy, Loader2 } from "@lucide/vue";

withDefaults(
  defineProps<{
    round: MusicQuizCurrentRound;
    busy: boolean;
    isReady: boolean;
    readyLabel: string;
    imageUrl: string;
    showLyrics: boolean;
    hasLyrics: boolean;
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
  },
);
const emit = defineEmits<{ ready: []; "copy-title": [] }>();
</script>

<style scoped>
.quiz-reveal {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  padding: 0.875rem;
}

.quiz-reveal__track {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 0.625rem;
}

.quiz-reveal__title {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  align-self: center;
  gap: 0.625rem;
  width: min(100%, 320px);
}

.quiz-reveal__title h2 {
  margin: 0;
  overflow-wrap: anywhere;
}

.quiz-reveal__lyrics {
  height: clamp(220px, 34dvh, 360px);
  min-height: 220px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--background);
  padding: 0.25rem;
}

.quiz-reveal__lyrics-loading {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--muted-foreground);
  font-weight: 600;
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

.quiz-reveal__cover {
  width: min(100%, 320px);
  aspect-ratio: 1;
  align-self: center;
  border-radius: 8px;
  object-fit: cover;
  background: var(--muted);
}

/* this component only renders during the reveal phase, so the wide layout
   needs no parent phase modifier */
@media (min-width: 900px) {
  .quiz-reveal {
    gap: 1rem;
    padding: 1rem;
  }

  .quiz-reveal--with-lyrics {
    --quiz-reveal-lyrics-height: clamp(360px, 52dvh, 560px);
    --quiz-reveal-title-space: 4.25rem;
    --quiz-reveal-artwork-height: calc(
      var(--quiz-reveal-lyrics-height) - var(--quiz-reveal-title-space)
    );

    display: grid;
    grid-template-columns: minmax(220px, min(30vw, 320px)) minmax(0, 1fr);
    grid-template-areas:
      "ready ready"
      "track lyrics";
    align-items: start;
  }

  .quiz-reveal--with-lyrics > button:first-child {
    grid-area: ready;
    justify-self: center;
    min-width: min(100%, 22rem);
  }

  .quiz-reveal--with-lyrics .quiz-reveal__track {
    grid-area: track;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 0.75rem;
    width: 100%;
    height: var(--quiz-reveal-lyrics-height);
    min-height: 0;
  }

  .quiz-reveal--with-lyrics .quiz-reveal__cover {
    width: auto;
    height: auto;
    max-width: 100%;
    max-height: var(--quiz-reveal-artwork-height);
    aspect-ratio: auto;
    justify-self: center;
    align-self: center;
    object-fit: contain;
  }

  .quiz-reveal--with-lyrics .quiz-reveal__title {
    width: 100%;
    align-self: stretch;
  }

  .quiz-reveal--with-lyrics .quiz-reveal__title h2 {
    display: -webkit-box;
    overflow: hidden;
    font-size: clamp(1rem, 1.4vw, 1.3rem);
    line-height: 1.2;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .quiz-reveal--with-lyrics .quiz-reveal__lyrics {
    grid-area: lyrics;
    height: var(--quiz-reveal-lyrics-height);
    min-height: 360px;
  }

  .quiz-reveal--with-lyrics .quiz-reveal__lyrics :deep(.lyrics-line),
  .quiz-reveal--with-lyrics .quiz-reveal__lyrics :deep(.break-note) {
    font-size: clamp(1.65rem, 2.3vw, 2.8rem);
  }

  .quiz-reveal--with-lyrics .quiz-reveal__lyrics :deep(.song-title) {
    font-size: clamp(1.45rem, 2vw, 2.3rem);
  }

  .quiz-reveal--with-lyrics .quiz-reveal__lyrics :deep(.artist-name) {
    font-size: clamp(1.1rem, 1.4vw, 1.55rem);
  }
}
</style>
