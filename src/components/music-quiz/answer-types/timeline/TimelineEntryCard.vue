<template>
  <article
    :data-entry-id="entry.entry_id"
    :data-compact="compact ? 'true' : undefined"
    class="bg-card grid items-center border transition-colors motion-reduce:transition-none"
    :class="[
      compact
        ? 'h-full grid-cols-[3rem_minmax(0,1fr)] gap-2 rounded-lg p-2 shadow-none'
        : 'grid-cols-[4.25rem_minmax(0,1fr)] gap-3 rounded-xl p-3 shadow-sm sm:grid-cols-[5rem_minmax(0,1fr)]',
      highlighted
        ? 'border-primary bg-primary/5 ring-primary/20 ring-2'
        : 'border-border',
    ]"
  >
    <img
      v-if="imageUrl"
      :src="imageUrl"
      :alt="`${entry.title} - ${entry.artist}`"
      class="bg-muted aspect-square w-full object-cover"
      :class="compact ? 'rounded-md' : 'rounded-lg'"
    />
    <div
      v-else
      class="bg-muted text-muted-foreground grid aspect-square w-full place-items-center"
      :class="compact ? 'rounded-md' : 'rounded-lg'"
      aria-hidden="true"
    >
      <Music2 :class="compact ? 'size-4' : 'size-6'" />
    </div>

    <div class="flex min-w-0 flex-col" :class="compact ? 'gap-0.5' : 'gap-1'">
      <div class="flex flex-wrap items-center gap-2">
        <strong
          class="text-primary leading-none tabular-nums"
          :class="compact ? 'text-base' : 'text-xl'"
        >
          {{ entry.release_year }}
        </strong>
        <Badge
          v-if="entry.is_anchor"
          variant="secondary"
          :class="{ 'px-1.5 py-0 text-[0.625rem]': compact }"
        >
          {{ $t("providers.music_quiz.timeline_anchor") }}
        </Badge>
        <Badge
          v-if="highlighted"
          :class="{ 'px-1.5 py-0 text-[0.625rem]': compact }"
        >
          {{ $t("providers.music_quiz.timeline_revealed") }}
        </Badge>
      </div>
      <span class="truncate font-semibold" :class="{ 'text-sm': compact }">
        {{ entry.title }}
      </span>
      <span
        class="text-muted-foreground truncate"
        :class="compact ? 'text-xs' : 'text-sm'"
      >
        {{ entry.artist }}
      </span>
    </div>
  </article>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import type { MusicQuizTimelineEntry } from "@/composables/useMusicQuiz";
import { getMediaImageUrl } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import { Music2 } from "@lucide/vue";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    entry: MusicQuizTimelineEntry;
    highlighted?: boolean;
    compact?: boolean;
  }>(),
  {
    highlighted: false,
    compact: false,
  },
);

const imageUrl = computed(() => getMediaImageUrl(props.entry.image_url ?? ""));
</script>
