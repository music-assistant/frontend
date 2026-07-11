<template>
  <div class="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
    <MusicQuizQrCard
      class="lg:w-72"
      :join-link="joinLink"
      :caption="$t('providers.music_quiz.invite_players')"
    />

    <div class="flex flex-col gap-4">
      <slot name="game" />

      <div v-if="showActions" class="flex flex-wrap justify-end gap-2">
        <Button
          :disabled="busy"
          type="button"
          variant="outline"
          @click="emit('endGame')"
        >
          <Square class="size-4" />
          {{ $t("providers.music_quiz.end_game") }}
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
          {{ $t(revealLabelKey) }}
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
import { Button } from "@/components/ui/button";
import type { MusicQuizSupportedHostState } from "@/composables/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { Eye, Play, RotateCcw, SkipForward, Square } from "@lucide/vue";
import type { VNode } from "vue";

withDefaults(
  defineProps<{
    state: MusicQuizSupportedHostState;
    busy: boolean;
    joinLink: string;
    isLastRound: boolean;
    showActions?: boolean;
    revealLabelKey?: string;
  }>(),
  {
    showActions: true,
    revealLabelKey: "providers.music_quiz.phase_reveal",
  },
);
defineSlots<{ game: () => VNode[] }>();
const emit = defineEmits<{
  endGame: [];
  start: [];
  reveal: [];
  next: [];
  reset: [];
}>();
</script>
