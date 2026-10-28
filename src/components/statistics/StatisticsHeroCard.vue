<template>
  <section
    class="flex flex-wrap items-end gap-7 rounded-2xl border border-primary/25 bg-primary/15 px-8 py-7 text-foreground max-md:px-5 max-md:py-5"
    :aria-busy="loading"
    :aria-label="heading"
  >
    <div class="flex min-w-0 flex-[1_1_340px] flex-col gap-2.5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span
          class="text-[13px] font-medium tracking-[1px] text-primary uppercase"
        >
          {{ heading }}
        </span>
        <slot name="actions"></slot>
      </div>
      <template v-if="loading">
        <Skeleton class="h-16 w-3/5 bg-primary/20" />
        <Skeleton class="h-5 w-4/5 bg-primary/20" />
      </template>
      <p
        v-else-if="error"
        role="alert"
        class="m-0 flex min-h-16 items-center gap-2 text-base text-muted-foreground"
      >
        <CircleAlert class="size-5 shrink-0" aria-hidden="true" />
        {{ $t("statistics_section_failed") }}
      </p>
      <template v-else>
        <p
          class="m-0 text-[64px] leading-none font-extrabold tracking-[-2px] max-md:text-[44px]"
        >
          {{ totalLabel }}
        </p>
        <p class="m-0 max-w-[420px] text-base text-foreground/80">
          {{ sentence }}
        </p>
        <dl v-if="stats.length" class="mt-2.5 mb-0 flex flex-wrap gap-7">
          <div
            v-for="stat in stats"
            :key="stat.label"
            class="flex flex-col gap-0.5"
          >
            <dt class="text-xs text-muted-foreground">{{ stat.label }}</dt>
            <dd class="m-0 text-[22px] font-bold">{{ stat.value }}</dd>
          </div>
        </dl>
      </template>
    </div>
    <div class="flex min-w-0 flex-[2_1_480px] flex-col">
      <Skeleton v-if="loading" class="h-[190px] w-full bg-primary/20" />
      <StatisticsPlaysChart v-else-if="showChart" :data="chartData" />
    </div>
  </section>
</template>

<script setup lang="ts">
import StatisticsPlaysChart, {
  type PlaysChartDatum,
} from "@/components/statistics/StatisticsPlaysChart.vue";
import { Skeleton } from "@/components/ui/skeleton";
import { useCanonicalLocale } from "@/composables/useCanonicalLocale";
import {
  formatAverage,
  formatCount,
  formatHour,
} from "@/helpers/statistics_format";
import {
  formatBucketAxisLabel,
  formatBucketLabel,
  getPlayBucket,
  summarizePlays,
  type PlayBucket,
} from "@/helpers/statistics_time_series";
import type {
  StatisticsPeriod,
  StatisticsTimeSeriesPoint,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { CircleAlert } from "@lucide/vue";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    // gap-filled over the whole period
    points: StatisticsTimeSeriesPoint[];
    period: StatisticsPeriod;
    loading?: boolean;
    error?: boolean;
    // the busiest hour of the day, when listening activity is loaded too
    peakHour?: number;
  }>(),
  { peakHour: undefined },
);

interface HeroStat {
  label: string;
  value: string;
}

const locale = useCanonicalLocale();
const summary = computed(() => summarizePlays(props.points));
const bucket = computed<PlayBucket>(
  () =>
    getPlayBucket(props.points[0]?.timestamp ?? "") ??
    (props.period === "today" ? "hour" : "day"),
);
// a week of days reads best as weekday names
const preferWeekday = computed(() => props.period === "week");

const heading = computed(() => $t(`period_${props.period}`));
const totalLabel = computed(() =>
  $t("statistics_plays", summary.value.total, {
    named: { count: formatCount(summary.value.total, locale.value) },
  }),
);
const busiestLabel = computed(() => {
  const busiest = summary.value.busiest;
  return busiest ? formatBucketLabel(busiest.timestamp, locale.value) : "";
});
const sentence = computed(() => {
  if (summary.value.total === 0) return $t("no_statistics_data");
  const average = $t(`statistics_average_${bucket.value}`, {
    average: formatAverage(summary.value.average, locale.value),
  });
  const busiest = $t(`statistics_busiest_sentence_${bucket.value}`, {
    label: busiestLabel.value,
  });
  return `${average} ${busiest}`;
});

const stats = computed<HeroStat[]>(() => {
  const busiest = summary.value.busiest;
  if (!busiest) return [];
  const result: HeroStat[] = [
    {
      label: $t(`statistics_per_${bucket.value}`),
      value: formatAverage(summary.value.average, locale.value),
    },
    {
      label: $t(`statistics_busiest_${bucket.value}`),
      value: formatBucketAxisLabel(
        busiest.timestamp,
        locale.value,
        preferWeekday.value,
      ),
    },
  ];
  if (props.peakHour !== undefined && bucket.value !== "hour") {
    result.push({
      label: $t("statistics_peak_hour"),
      value: formatHour(props.peakHour, locale.value),
    });
  }
  return result;
});

const showChart = computed(() => !props.error && summary.value.total > 0);
const chartData = computed<PlaysChartDatum[]>(() =>
  props.points.map((point) => ({
    plays: point.value,
    label: formatBucketLabel(point.timestamp, locale.value),
    axisLabel: formatBucketAxisLabel(
      point.timestamp,
      locale.value,
      preferWeekday.value,
    ),
  })),
);
</script>
