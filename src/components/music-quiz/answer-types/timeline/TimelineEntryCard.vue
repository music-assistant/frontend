<template>
  <article
    :data-entry-id="entry.entry_id"
    :data-compact="compact ? 'true' : undefined"
    class="bg-card grid items-center border transition-colors motion-reduce:transition-none"
    :class="[
      compact
        ? 'h-full grid-cols-[2.5rem_minmax(0,1fr)_auto] gap-2 rounded-lg p-2 shadow-none'
        : 'grid-cols-[3.5rem_minmax(0,1fr)_auto] gap-3 rounded-xl p-3 shadow-sm',
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

    <div class="flex items-center gap-1.5 self-center">
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
      <strong
        class="text-primary font-bold tabular-nums"
        :class="compact ? 'text-base' : 'text-lg'"
      >
        {{ entry.release_year }}
      </strong>
    </div>
  </article>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import type { MusicQuizTimelineEntry } from "@/composables/music-quiz/useMusicQuiz";
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
