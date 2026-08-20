<template>
  <Card class="gap-4 py-4">
    <CardContent class="flex flex-col gap-4 px-4">
      <div class="flex flex-col items-center gap-3">
        <img
          v-if="imageUrl"
          :src="imageUrl"
          :alt="round.answer_label"
          class="bg-muted mx-auto aspect-square w-full max-w-[min(15rem,26dvh)] rounded-lg object-cover"
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
            :aria-label="$t('providers.music_quiz.copy_music_name')"
            @click="emit('copy-title')"
          >
            <Copy class="size-4" />
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MusicQuizGuessTheSongRound } from "@/composables/music-quiz/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { Copy } from "@lucide/vue";

withDefaults(
  defineProps<{
    round: MusicQuizGuessTheSongRound;
    imageUrl: string;
    showCopyButton?: boolean;
  }>(),
  {
    showCopyButton: true,
  },
);
const emit = defineEmits<{ "copy-title": [] }>();
</script>
