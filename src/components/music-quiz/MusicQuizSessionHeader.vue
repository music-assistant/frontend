<template>
  <section
    data-testid="music-quiz-session-header"
    class="bg-card flex min-w-0 flex-col rounded-xl border shadow-sm sm:flex-row sm:items-center"
    :class="present ? 'gap-2 p-3 sm:p-4' : 'gap-3 p-4'"
  >
    <div class="flex min-w-0 flex-1 items-center gap-3">
      <span
        class="bg-primary/10 text-primary grid shrink-0 place-items-center rounded-lg"
        :class="present ? 'size-11 sm:size-12' : 'size-11'"
      >
        <component
          :is="game.icon"
          :class="present ? 'size-5 sm:size-6' : 'size-5'"
          aria-hidden="true"
        />
      </span>
      <div class="min-w-0">
        <p
          v-if="name"
          class="text-primary text-xs font-bold tracking-wide uppercase"
        >
          {{ $t(game.labelKey) }}
        </p>
        <component
          :is="present ? 'h1' : 'h2'"
          class="truncate font-bold"
          :class="present ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'"
        >
          {{ name || $t(game.labelKey) }}
        </component>
        <div
          class="flex flex-wrap items-center"
          :class="present ? 'mt-0.5 gap-1.5' : 'mt-1 gap-2'"
        >
          <Badge
            variant="secondary"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {{ phaseLabel }}
          </Badge>
          <Badge v-if="roundLabel" variant="outline">{{ roundLabel }}</Badge>
          <Badge
            v-if="showMode"
            data-testid="music-quiz-mode"
            variant="outline"
          >
            {{ modeLabel }}
          </Badge>
        </div>
      </div>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 justify-end">
      <slot name="actions" />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { MusicQuizGameDefinition } from "@/components/music-quiz/game_types";
import { Badge } from "@/components/ui/badge";
import type { MusicQuizMode } from "@/composables/music-quiz/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    game: MusicQuizGameDefinition;
    name?: string | null;
    phaseLabel: string;
    roundLabel?: string;
    mode?: MusicQuizMode;
    listenInEnabled?: boolean;
    present?: boolean;
  }>(),
  {
    name: null,
    roundLabel: "",
    mode: undefined,
    listenInEnabled: false,
    present: false,
  },
);

const showMode = computed(
  () => props.listenInEnabled && props.mode !== undefined,
);
const modeLabel = computed(() =>
  props.mode === "remote"
    ? $t("providers.music_quiz.mode_remote")
    : $t("providers.music_quiz.mode_venue"),
);
</script>
