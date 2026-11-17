<template>
  <div
    role="img"
    :aria-label="ariaLabel"
    class="flex flex-wrap justify-center gap-x-6 gap-y-3"
    data-testid="hint-text-mask"
  >
    <div
      v-for="(word, wordIndex) in words"
      :key="wordIndex"
      class="flex gap-1"
      aria-hidden="true"
    >
      <span
        v-for="(cell, cellIndex) in word"
        :key="`${cellIndex}-${cell.character ?? ''}`"
        :class="
          cn(
            'flex items-end justify-center font-mono font-bold',
            cellSizeClass,
            cell.hidden
              ? 'border-muted-foreground/60 border-b-2'
              : 'hint-text-revealed border-primary border-b-2',
          )
        "
      >
        {{ cell.character ?? "" }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MusicQuizHintTextMask } from "@/composables/music-quiz/useMusicQuiz";
import {
  countHiddenHintLetters,
  splitHintTextMask,
} from "@/helpers/music_quiz_hint_text";
import { cn } from "@/lib/utils";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const CELL_SIZE_CLASSES = {
  md: "h-9 w-6 text-xl",
  lg: "h-16 w-11 text-4xl",
} as const;

const props = withDefaults(
  defineProps<{
    mask: MusicQuizHintTextMask;
    size?: keyof typeof CELL_SIZE_CLASSES;
  }>(),
  { size: "md" },
);

const words = computed(() => splitHintTextMask(props.mask));
const cellSizeClass = computed(() => CELL_SIZE_CLASSES[props.size]);
const visibleTitle = computed(() =>
  props.mask.map((character) => character ?? "_").join(""),
);
const ariaLabel = computed(() =>
  $t("providers.music_quiz.title_reveal_mask_label", [
    visibleTitle.value,
    countHiddenHintLetters(props.mask),
  ]),
);
</script>

<style scoped>
.hint-text-revealed {
  animation: hint-text-pop 0.4s ease-out;
}

@keyframes hint-text-pop {
  from {
    opacity: 0;
    transform: translateY(-0.5rem) scale(1.3);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hint-text-revealed {
    animation: none;
  }
}
</style>
