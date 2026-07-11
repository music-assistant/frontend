<template>
  <div class="flex flex-col gap-2">
    <p v-if="selectable" class="text-muted-foreground text-center text-sm">
      {{ $t("providers.music_quiz.timeline_place_help") }}
    </p>
    <ol
      class="mx-auto flex w-full max-w-2xl flex-col"
      :aria-label="$t('providers.music_quiz.timeline')"
    >
      <template v-for="boundary in boundaries" :key="boundary.key">
        <li v-if="selectable" class="relative z-10 -my-1 flex justify-center">
          <Button
            type="button"
            size="sm"
            class="bg-background min-h-11 min-w-44 rounded-full"
            :variant="boundary.selected ? 'default' : 'outline'"
            :disabled="disabled"
            :aria-label="boundary.label"
            :aria-pressed="boundary.selected"
            :data-previous-entry-id="boundary.previousEntryId"
            :data-next-entry-id="boundary.nextEntryId"
            @click="
              emit('select', boundary.previousEntryId, boundary.nextEntryId)
            "
          >
            <Check v-if="boundary.selected" class="size-4" />
            <Plus v-else class="size-4" />
            {{
              boundary.selected
                ? $t("providers.music_quiz.timeline_placed_here")
                : $t("providers.music_quiz.timeline_place_here")
            }}
          </Button>
        </li>
        <li
          v-if="boundary.entry"
          class="border-primary/25 border-l-2 py-2 pl-3"
        >
          <TimelineEntryCard
            :entry="boundary.entry"
            :highlighted="boundary.entry.entry_id === highlightedEntryId"
          />
        </li>
      </template>
    </ol>
  </div>
</template>

<script setup lang="ts">
import TimelineEntryCard from "@/components/music-quiz/answer-types/timeline/TimelineEntryCard.vue";
import { Button } from "@/components/ui/button";
import type { MusicQuizTimelineEntry } from "@/composables/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { Check, Plus } from "@lucide/vue";
import { computed } from "vue";

interface TimelineBoundary {
  key: string;
  previousEntryId: string | null;
  nextEntryId: string | null;
  entry?: MusicQuizTimelineEntry;
  label: string;
  selected: boolean;
}

const props = withDefaults(
  defineProps<{
    entries: MusicQuizTimelineEntry[];
    selectable?: boolean;
    disabled?: boolean;
    selectedPreviousEntryId?: string | null;
    selectedNextEntryId?: string | null;
    highlightedEntryId?: string | null;
  }>(),
  {
    selectable: false,
    disabled: false,
    selectedPreviousEntryId: null,
    selectedNextEntryId: null,
    highlightedEntryId: null,
  },
);
const emit = defineEmits<{
  select: [previousEntryId: string | null, nextEntryId: string | null];
}>();

const boundaries = computed<TimelineBoundary[]>(() =>
  Array.from({ length: props.entries.length + 1 }, (_, index) => {
    const previous = props.entries[index - 1];
    const next = props.entries[index];
    const previousEntryId = previous?.entry_id ?? null;
    const nextEntryId = next?.entry_id ?? null;
    return {
      key: `${previousEntryId ?? "start"}:${nextEntryId ?? "end"}`,
      previousEntryId,
      nextEntryId,
      entry: next,
      label: boundaryLabel(previous, next),
      selected:
        previousEntryId === props.selectedPreviousEntryId &&
        nextEntryId === props.selectedNextEntryId,
    };
  }),
);

function boundaryLabel(
  previous: MusicQuizTimelineEntry | undefined,
  next: MusicQuizTimelineEntry | undefined,
) {
  if (!previous && next) {
    return $t("providers.music_quiz.timeline_place_before", [
      next.release_year,
      next.title,
    ]);
  }
  if (previous && !next) {
    return $t("providers.music_quiz.timeline_place_after", [
      previous.release_year,
      previous.title,
    ]);
  }
  if (previous && next) {
    return $t("providers.music_quiz.timeline_place_between", [
      previous.release_year,
      previous.title,
      next.release_year,
      next.title,
    ]);
  }
  return $t("providers.music_quiz.timeline_place_here");
}
</script>
