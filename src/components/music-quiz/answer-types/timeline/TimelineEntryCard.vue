<template>
  <article
    :data-entry-id="entry.entry_id"
    class="bg-card grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-3 rounded-xl border p-3 shadow-sm transition-colors sm:grid-cols-[5rem_minmax(0,1fr)]"
    :class="
      highlighted
        ? 'border-primary bg-primary/5 ring-primary/20 ring-2'
        : 'border-border'
    "
  >
    <img
      v-if="imageUrl"
      :src="imageUrl"
      :alt="`${entry.title} - ${entry.artist}`"
      class="bg-muted aspect-square w-full rounded-lg object-cover"
    />
    <div
      v-else
      class="bg-muted text-muted-foreground grid aspect-square w-full place-items-center rounded-lg"
      aria-hidden="true"
    >
      <Music2 class="size-6" />
    </div>

    <div class="flex min-w-0 flex-col gap-1">
      <div class="flex flex-wrap items-center gap-2">
        <strong class="text-primary text-xl leading-none tabular-nums">
          {{ entry.release_year }}
        </strong>
        <Badge v-if="entry.is_anchor" variant="secondary">
          {{ $t("providers.music_quiz.timeline_anchor") }}
        </Badge>
        <Badge v-if="highlighted">
          {{ $t("providers.music_quiz.timeline_revealed") }}
        </Badge>
      </div>
      <span class="truncate font-semibold">{{ entry.title }}</span>
      <span class="text-muted-foreground truncate text-sm">
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
  }>(),
  {
    highlighted: false,
  },
);

const imageUrl = computed(() => getMediaImageUrl(props.entry.image_url ?? ""));
</script>
