<template>
  <section
    data-testid="music-quiz-session-header"
    class="bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-4 shadow-sm sm:flex-row sm:items-center"
    :class="{ 'p-5 sm:p-6': present }"
  >
    <div class="flex min-w-0 flex-1 items-center gap-3">
      <span
        class="bg-primary/10 text-primary grid shrink-0 place-items-center rounded-lg"
        :class="present ? 'size-14' : 'size-11'"
      >
        <component
          :is="game.icon"
          :class="present ? 'size-7' : 'size-5'"
          aria-hidden="true"
        />
      </span>
      <div class="min-w-0">
        <p
          v-if="name"
          class="text-primary text-xs font-bold tracking-wide uppercase"
          :class="{ 'sm:text-sm': present }"
        >
          {{ $t(game.labelKey) }}
        </p>
        <component
          :is="present ? 'h1' : 'h2'"
          class="truncate font-bold"
          :class="present ? 'text-2xl sm:text-4xl' : 'text-lg sm:text-xl'"
        >
          {{ name || $t(game.labelKey) }}
        </component>
        <div class="mt-1 flex flex-wrap items-center gap-2">
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
import type { MusicQuizMode } from "@/composables/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    game: MusicQuizGameDefinition;
    name?: string | null;
    phaseLabel: string;
    roundLabel?: string;
    mode?: MusicQuizMode;
    present?: boolean;
  }>(),
  {
    name: null,
    roundLabel: "",
    mode: undefined,
    present: false,
  },
);

const showMode = computed(
  () => props.game.supportsListenIn && props.mode !== undefined,
);
const modeLabel = computed(() =>
  props.mode === "remote"
    ? $t("providers.music_quiz.mode_remote")
    : $t("providers.music_quiz.mode_venue"),
);
</script>
