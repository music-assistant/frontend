<template>
  <section class="flex flex-col gap-3" :aria-busy="loading">
    <h2 class="m-0 text-lg font-bold">{{ $t("statistics_most_played") }}</h2>
    <div v-if="loading" class="flex gap-2 overflow-hidden">
      <EditorialCardSkeleton v-for="n in limit" :key="n" />
    </div>
    <p
      v-else-if="error"
      role="alert"
      class="m-0 flex min-h-[120px] items-center gap-2 text-sm text-muted-foreground"
    >
      <CircleAlert class="size-4 shrink-0" aria-hidden="true" />
      {{ $t("statistics_section_failed") }}
    </p>
    <p
      v-else-if="tracks.length === 0"
      class="m-0 flex min-h-[120px] items-center text-sm text-muted-foreground"
    >
      {{ $t("statistics_section_empty") }}
    </p>
    <ol
      v-else
      class="ma-scroll m-0 flex list-none gap-2 overflow-x-auto overscroll-x-contain p-0 pb-1"
    >
      <li v-for="(entry, index) in shownTracks" :key="entry.item.uri">
        <EditorialMediaCard
          :item="entry.item"
          :is-available="itemIsAvailable(entry.item)"
        >
          <template #art-overlay>
            <span
              class="absolute top-2.5 left-2.5 z-[3] flex h-7 min-w-7 items-center justify-center rounded-full bg-background px-1.5 text-[13px] font-bold text-foreground"
              aria-hidden="true"
            >
              {{ index + 1 }}
            </span>
          </template>
          <template #subtitle>
            {{ playsLabel(entry.play_count) }}
          </template>
        </EditorialMediaCard>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import EditorialCardSkeleton from "@/components/discover/EditorialCardSkeleton.vue";
import EditorialMediaCard from "@/components/discover/EditorialMediaCard.vue";
import { useCanonicalLocale } from "@/composables/useCanonicalLocale";
import { formatCount } from "@/helpers/statistics_format";
import { itemIsAvailable } from "@/plugins/api/helpers";
import type { StatisticsTopItemResult } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { CircleAlert } from "@lucide/vue";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    tracks: StatisticsTopItemResult[];
    loading?: boolean;
    error?: boolean;
    limit?: number;
  }>(),
  { limit: 10 },
);

const locale = useCanonicalLocale();
const shownTracks = computed(() => props.tracks.slice(0, props.limit));

const playsLabel = (count: number): string =>
  $t("statistics_plays", count, {
    named: { count: formatCount(count, locale.value) },
  });
</script>
