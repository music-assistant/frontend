<template>
  <BaseChartCard
    :title="title"
    :loading="loading"
    :is-empty="data.length === 0"
  >
    <div class="w-full overflow-x-auto">
      <table class="w-full min-w-[360px] border-separate border-spacing-y-1">
        <caption class="sr-only">
          {{
            title
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col" class="w-8"></th>
            <th
              v-for="hour in hours"
              :key="hour"
              scope="col"
              :aria-label="`${hour}:00`"
              class="text-[10px] font-normal text-muted-foreground"
            >
              <span aria-hidden="true">{{
                hour % 6 === 0 ? `${hour}:00` : ""
              }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(weekday, weekdayIndex) in weekdays" :key="weekdayIndex">
            <th
              scope="row"
              class="pr-2 text-left text-[11px] font-normal text-muted-foreground"
            >
              {{ weekday }}
            </th>
            <td
              v-for="hour in hours"
              :key="hour"
              class="h-3 min-w-2 rounded-[2px]"
              :style="cellStyle(activity[weekdayIndex][hour])"
              :title="
                activityLabel(weekday, hour, activity[weekdayIndex][hour])
              "
            >
              <span class="sr-only">
                {{ activityLabel(weekday, hour, activity[weekdayIndex][hour]) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </BaseChartCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import BaseChartCard from "./BaseChartCard.vue";
import { $t, canonicalizeLocale, i18n } from "@/plugins/i18n";

import type { StatisticsHeatmapPoint } from "@/plugins/api/interfaces";

const props = withDefaults(
  defineProps<{
    title: string;
    data: StatisticsHeatmapPoint[];
    loading?: boolean;
  }>(),
  { loading: false },
);

const hours = Array.from({ length: 24 }, (_, hour) => hour);
const weekdays = computed(() => {
  const formatter = new Intl.DateTimeFormat(
    canonicalizeLocale(i18n.global.locale.value),
    {
      weekday: "short",
      timeZone: "UTC",
    },
  );
  return Array.from({ length: 7 }, (_, weekday) =>
    formatter.format(new Date(Date.UTC(2024, 0, weekday + 1))),
  );
});

const activity = computed(() => {
  const counts = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const point of props.data) {
    if (
      Number.isInteger(point.weekday) &&
      point.weekday >= 0 &&
      point.weekday < 7 &&
      Number.isInteger(point.hour) &&
      point.hour >= 0 &&
      point.hour < 24
    ) {
      const row = counts[point.weekday];
      if (row) row[point.hour] += point.value;
    }
  }
  return counts;
});

const maxActivity = computed(() => Math.max(1, ...activity.value.flat()));

const cellStyle = (value: number) => ({
  backgroundColor: `rgba(var(--v-theme-primary), ${value === 0 ? 0.06 : 0.2 + (value / maxActivity.value) * 0.8})`,
});

const activityLabel = (weekday: string, hour: number, plays: number): string =>
  $t("statistics_activity_cell", { weekday, hour: `${hour}:00`, plays });
</script>
