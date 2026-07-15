<template>
  <div
    class="flex min-w-0 flex-col gap-2"
    :data-orientation="horizontal ? 'horizontal' : 'vertical'"
  >
    <p v-if="selectable" class="text-muted-foreground text-center text-sm">
      {{ $t("providers.music_quiz.timeline_place_help") }}
    </p>
    <p
      v-if="entries.length"
      class="text-muted-foreground flex items-center justify-center gap-2 text-xs font-semibold"
      aria-hidden="true"
    >
      <span>{{ $t("providers.music_quiz.timeline_older") }}</span>
      <ArrowRight v-if="horizontal" class="size-4" />
      <ArrowDown v-else class="size-4" />
      <span>{{ $t("providers.music_quiz.timeline_newer") }}</span>
    </p>
    <div
      ref="containerRef"
      data-timeline-scroll
      :class="{
        'min-w-0 overflow-x-auto overscroll-x-contain pb-1': horizontal,
      }"
    >
      <ol
        class="flex"
        :class="
          horizontal
            ? 'w-max min-w-full flex-row items-stretch gap-2'
            : 'mx-auto w-full max-w-2xl flex-col'
        "
        :aria-label="$t('providers.music_quiz.timeline_order')"
      >
        <template v-for="boundary in boundaries" :key="boundary.key">
          <li
            v-if="selectable && entries.length"
            class="relative z-10 flex justify-center py-2"
          >
            <Button
              type="button"
              size="sm"
              class="h-auto min-h-11 min-w-44 max-w-full rounded-full px-4 py-2 text-center whitespace-normal"
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
                  : boundary.actionLabel
              }}
            </Button>
          </li>
          <li
            v-if="boundary.entry"
            class="border-primary/25"
            :class="
              horizontal
                ? 'w-52 shrink-0 border-t-2 pt-2'
                : 'border-l-2 py-2 pl-3'
            "
          >
            <TimelineEntryCard
              :entry="boundary.entry"
              :highlighted="boundary.entry.entry_id === highlightedEntryId"
              :compact="compact"
            />
          </li>
        </template>
      </ol>
    </div>
  </div>
</template>

<script setup lang="ts">
import TimelineEntryCard from "@/components/music-quiz/answer-types/timeline/TimelineEntryCard.vue";
import { Button } from "@/components/ui/button";
import type { MusicQuizTimelineEntry } from "@/composables/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { ArrowDown, ArrowRight, Check, Plus } from "@lucide/vue";
import { computed, nextTick, ref, watch } from "vue";

interface TimelineBoundary {
  key: string;
  previousEntryId: string | null;
  nextEntryId: string | null;
  entry?: MusicQuizTimelineEntry;
  actionLabel: string;
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
    horizontal?: boolean;
    compact?: boolean;
  }>(),
  {
    selectable: false,
    disabled: false,
    selectedPreviousEntryId: null,
    selectedNextEntryId: null,
    highlightedEntryId: null,
    horizontal: false,
    compact: false,
  },
);
const emit = defineEmits<{
  select: [previousEntryId: string | null, nextEntryId: string | null];
}>();

const containerRef = ref<HTMLElement | null>(null);
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
      actionLabel: boundaryActionLabel(previous, next),
      label: boundaryLabel(previous, next),
      selected:
        previousEntryId === props.selectedPreviousEntryId &&
        nextEntryId === props.selectedNextEntryId,
    };
  }),
);

watch(
  () => ({
    horizontal: props.horizontal,
    highlightedEntryId: props.highlightedEntryId,
    entryIds: props.entries.map((entry) => entry.entry_id).join("\0"),
  }),
  async ({ horizontal, highlightedEntryId }) => {
    if (!horizontal || !highlightedEntryId) return;
    await nextTick();
    scrollEntryIntoView(highlightedEntryId);
  },
  { flush: "post", immediate: true },
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

function boundaryActionLabel(
  previous: MusicQuizTimelineEntry | undefined,
  next: MusicQuizTimelineEntry | undefined,
) {
  if (!previous && next) {
    return $t("providers.music_quiz.timeline_place_before_year", [
      next.release_year,
    ]);
  }
  if (previous && !next) {
    return $t("providers.music_quiz.timeline_place_after_year", [
      previous.release_year,
    ]);
  }
  if (previous && next) {
    if (previous.release_year === next.release_year) {
      return $t("providers.music_quiz.timeline_place_in_year", [
        previous.release_year,
      ]);
    }
    return $t("providers.music_quiz.timeline_place_between_years", [
      previous.release_year,
      next.release_year,
    ]);
  }
  return $t("providers.music_quiz.timeline_place_here");
}

function scrollEntryIntoView(entryId: string) {
  const entry = Array.from(
    containerRef.value?.querySelectorAll<HTMLElement>("[data-entry-id]") ?? [],
  ).find((element) => element.dataset.entryId === entryId);
  if (!entry?.scrollIntoView) return;

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  entry.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "nearest",
    inline: "center",
  });
}
</script>
