<template>
  <StatisticsCard
    :title="$t('statistics_top_genre')"
    :loading="loading"
    :error="error"
    :empty="segments.length === 0"
    :empty-text="$t('statistics_genre_empty')"
  >
    <span class="text-[22px] font-bold">{{ segments[0]?.name }}</span>
    <div
      class="flex h-3.5 gap-0.5 overflow-hidden rounded-full"
      role="img"
      :aria-label="accessibleLabel"
    >
      <span
        v-for="(segment, index) in segments"
        :key="segment.isOther ? OTHER_KEY : segment.name"
        :class="['h-full', segmentClass(segment, index)]"
        :style="{ flex: `${segment.value} 1 0` }"
      ></span>
    </div>
    <ul
      class="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-1.5 p-0"
      aria-hidden="true"
    >
      <li
        v-for="(segment, index) in segments"
        :key="segment.isOther ? OTHER_KEY : segment.name"
        class="flex min-w-0 items-center gap-2 text-[13px]"
      >
        <span
          :class="[
            'size-2.5 shrink-0 rounded-[3px]',
            segmentClass(segment, index),
          ]"
        ></span>
        <span class="min-w-0 flex-1 truncate">{{ segmentName(segment) }}</span>
        <span class="text-muted-foreground tabular-nums">
          {{ segment.share }}%
        </span>
      </li>
    </ul>
  </StatisticsCard>
</template>

<script setup lang="ts">
import StatisticsCard from "@/components/statistics/StatisticsCard.vue";
import {
  shareSegments,
  type ShareSegment,
} from "@/helpers/statistics_rankings";
import type { StatisticsDistributionItem } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const props = defineProps<{
  genres: StatisticsDistributionItem[];
  loading?: boolean;
  error?: boolean;
}>();

const OTHER_KEY = "__other__";
// named genres from strongest to faintest; the rest is grey
const SEGMENT_CLASSES = [
  "bg-primary",
  "bg-primary/70",
  "bg-primary/45",
  "bg-primary/25",
];
const OTHER_SEGMENT_CLASS = "bg-muted-foreground/40";

const segments = computed(() => shareSegments(props.genres));

const segmentClass = (segment: ShareSegment, index: number): string =>
  segment.isOther
    ? OTHER_SEGMENT_CLASS
    : SEGMENT_CLASSES[index % SEGMENT_CLASSES.length];
const segmentName = (segment: ShareSegment): string =>
  segment.isOther ? $t("statistics_genre_other") : segment.name;

const accessibleLabel = computed(() =>
  $t("statistics_genres_accessible", {
    values: segments.value
      .map((segment) => `${segmentName(segment)} ${segment.share}%`)
      .join(", "),
  }),
);
</script>
