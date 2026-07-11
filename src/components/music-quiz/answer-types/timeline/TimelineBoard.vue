<template>
  <div
    class="focus-visible:ring-ring max-h-[34rem] touch-pan-x touch-pan-y overflow-auto overscroll-auto rounded-xl outline-none focus-visible:ring-2"
    role="region"
    :aria-label="$t('providers.music_quiz.timeline')"
    :tabindex="interactive && !disabled ? undefined : 0"
  >
    <ol class="flex min-w-72 flex-col px-1 py-2">
      <li
        v-for="boundary in boundaries"
        :key="getMusicQuizTimelineBoundaryKey(boundary)"
        class="flex flex-col"
      >
        <Button
          v-if="interactive"
          type="button"
          class="my-1 min-h-11 w-full border-dashed whitespace-normal"
          :data-boundary-key="getMusicQuizTimelineBoundaryKey(boundary)"
          :disabled="disabled"
          :variant="isSelected(boundary) ? 'default' : 'outline'"
          :aria-pressed="isSelected(boundary)"
          @click="select(boundary)"
        >
          <BetweenVerticalStart class="size-4 shrink-0" />
          <span>{{ boundaryLabel(boundary) }}</span>
          <span class="sr-only">. {{ boundaryContext(boundary) }}</span>
        </Button>

        <article
          v-if="boundary.nextEntry"
          :data-entry-id="boundary.nextEntry.entry_id"
          class="bg-card relative grid min-h-24 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 rounded-xl border p-3 shadow-sm"
          :class="
            boundary.nextEntry.entry_id === highlightEntryId
              ? 'border-primary ring-primary/20 ring-4'
              : ''
          "
        >
          <img
            v-if="boundary.nextEntry.image_url"
            :src="getMediaImageUrl(boundary.nextEntry.image_url)"
            :alt="`${boundary.nextEntry.title} - ${boundary.nextEntry.artist}`"
            class="bg-muted aspect-square size-[4.5rem] rounded-lg object-cover"
          />
          <span
            v-else
            class="bg-muted text-muted-foreground grid aspect-square size-[4.5rem] place-items-center rounded-lg"
            aria-hidden="true"
          >
            <Music2 class="size-7" />
          </span>

          <span class="flex min-w-0 flex-col gap-1">
            <span class="flex flex-wrap items-center gap-2">
              <Badge class="text-sm">{{
                boundary.nextEntry.release_year
              }}</Badge>
              <Badge
                v-if="boundary.nextEntry.is_anchor"
                variant="secondary"
                class="gap-1"
              >
                <Anchor class="size-3" />
                {{ $t("providers.music_quiz.timeline_anchor") }}
              </Badge>
              <Badge
                v-if="boundary.nextEntry.entry_id === highlightEntryId"
                variant="secondary"
                class="gap-1"
              >
                <Sparkles class="size-3" />
                {{ $t("providers.music_quiz.timeline_new_entry") }}
              </Badge>
            </span>
            <strong class="leading-tight break-words">
              {{ boundary.nextEntry.title }}
            </strong>
            <span class="text-muted-foreground text-sm break-words">
              {{ boundary.nextEntry.artist }}
            </span>
          </span>
        </article>
      </li>
    </ol>
  </div>
</template>

<script setup lang="ts">
import {
  getMusicQuizTimelineBoundaries,
  getMusicQuizTimelineBoundaryKey,
  type MusicQuizTimelineBoundary,
} from "@/components/music-quiz/answer-types/timeline/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MusicQuizTimelineEntry } from "@/composables/useMusicQuiz";
import { getMediaImageUrl } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import { Anchor, BetweenVerticalStart, Music2, Sparkles } from "@lucide/vue";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    timeline: MusicQuizTimelineEntry[];
    interactive?: boolean;
    disabled?: boolean;
    selectedBoundary?: Pick<
      MusicQuizTimelineBoundary,
      "previous_entry_id" | "next_entry_id"
    > | null;
    highlightEntryId?: string | null;
  }>(),
  {
    interactive: false,
    disabled: false,
    selectedBoundary: null,
    highlightEntryId: null,
  },
);
const emit = defineEmits<{
  select: [
    boundary: Pick<
      MusicQuizTimelineBoundary,
      "previous_entry_id" | "next_entry_id"
    >,
  ];
}>();

const boundaries = computed(() =>
  getMusicQuizTimelineBoundaries(props.timeline),
);

function select(boundary: MusicQuizTimelineBoundary) {
  if (props.disabled) return;
  emit("select", {
    previous_entry_id: boundary.previous_entry_id,
    next_entry_id: boundary.next_entry_id,
  });
}

function isSelected(boundary: MusicQuizTimelineBoundary) {
  return (
    props.selectedBoundary?.previous_entry_id === boundary.previous_entry_id &&
    props.selectedBoundary?.next_entry_id === boundary.next_entry_id
  );
}

function boundaryLabel(boundary: MusicQuizTimelineBoundary) {
  if (!boundary.previousEntry)
    return $t("providers.music_quiz.timeline_place_at_start");
  if (!boundary.nextEntry)
    return $t("providers.music_quiz.timeline_place_at_end");
  return $t("providers.music_quiz.timeline_place_between_years", [
    boundary.previousEntry.release_year,
    boundary.nextEntry.release_year,
  ]);
}

function boundaryContext(boundary: MusicQuizTimelineBoundary) {
  if (!boundary.previousEntry && boundary.nextEntry) {
    return $t("providers.music_quiz.timeline_place_before", [
      boundary.nextEntry.release_year,
      boundary.nextEntry.title,
    ]);
  }
  if (boundary.previousEntry && !boundary.nextEntry) {
    return $t("providers.music_quiz.timeline_place_after", [
      boundary.previousEntry.release_year,
      boundary.previousEntry.title,
    ]);
  }
  if (boundary.previousEntry && boundary.nextEntry) {
    return $t("providers.music_quiz.timeline_place_between", [
      boundary.previousEntry.release_year,
      boundary.previousEntry.title,
      boundary.nextEntry.release_year,
      boundary.nextEntry.title,
    ]);
  }
  return $t("providers.music_quiz.timeline_place_at_start");
}
</script>
