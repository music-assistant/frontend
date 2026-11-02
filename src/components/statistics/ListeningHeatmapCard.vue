<template>
  <StatisticsCard
    prominent
    :title="$t('statistics_heatmap')"
    :subtitle="$t('statistics_heatmap_subtitle')"
    :loading="loading"
    :error="error"
    :empty="data.length === 0"
    min-height-class="min-h-[280px]"
  >
    <template #header>
      <div
        class="flex items-center gap-1.5 text-[11px] text-muted-foreground"
        aria-hidden="true"
      >
        {{ $t("statistics_heatmap_less") }}
        <span
          v-for="level in LEGEND_LEVELS"
          :key="level"
          class="size-3 rounded-[3px]"
          :style="{ backgroundColor: cellColor(level) }"
        ></span>
        {{ $t("statistics_heatmap_more") }}
      </div>
    </template>
    <div class="overflow-x-auto">
      <table
        class="w-full min-w-[520px] border-separate border-spacing-1 [table-layout:fixed]"
      >
        <caption class="sr-only">
          {{
            $t("statistics_heatmap_subtitle")
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col" class="w-[34px]">
              <span class="sr-only">{{ $t("statistics_heatmap") }}</span>
            </th>
            <th
              v-for="hour in hours"
              :key="hour"
              scope="col"
              :aria-label="hourLabels[hour]"
              class="p-0 text-left text-[11px] font-normal whitespace-nowrap text-muted-foreground"
            >
              <span aria-hidden="true">{{
                hour % AXIS_HOUR_STEP === 0 ? hourLabels[hour] : ""
              }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(weekday, weekdayIndex) in weekdays" :key="weekday">
            <th
              scope="row"
              class="p-0 text-left text-[11px] font-normal text-muted-foreground"
            >
              {{ weekday }}
            </th>
            <td
              v-for="hour in hours"
              :key="hour"
              class="h-[22px] rounded-[3px] p-0"
              :style="{
                backgroundColor: cellColor(grid[weekdayIndex][hour] / maxPlays),
              }"
              :title="cellLabel(weekdayIndex, hour)"
            >
              <span class="sr-only">{{ cellLabel(weekdayIndex, hour) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </StatisticsCard>
</template>

<script setup lang="ts">
import StatisticsCard from "@/components/statistics/StatisticsCard.vue";
import { useCanonicalLocale } from "@/composables/useCanonicalLocale";
import { activityGrid, HOURS_PER_DAY } from "@/helpers/statistics_activity";
import {
  formatCount,
  formatHour,
  weekdayNames,
} from "@/helpers/statistics_format";
import type { StatisticsHeatmapPoint } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const props = defineProps<{
  data: StatisticsHeatmapPoint[];
  loading?: boolean;
  error?: boolean;
}>();

const AXIS_HOUR_STEP = 6;
// relative play levels shown in the legend
const LEGEND_LEVELS = [0, 0.25, 0.5, 0.75, 1];
// percent of primary for an empty cell, and the range above it
const EMPTY_CELL_PERCENT = 6;
const MIN_PLAYED_PERCENT = 12;

const locale = useCanonicalLocale();
const hours = Array.from({ length: HOURS_PER_DAY }, (_, hour) => hour);
const hourLabels = computed(() =>
  hours.map((hour) => formatHour(hour, locale.value)),
);
const weekdays = computed(() => weekdayNames(locale.value));
const longWeekdays = computed(() => weekdayNames(locale.value, "long"));
const grid = computed(() => activityGrid(props.data));
const maxPlays = computed(() => Math.max(1, ...grid.value.flat()));

/** The cell colour for a share (0-1) of the busiest cell. */
function cellColor(level: number): string {
  const percent =
    level <= 0
      ? EMPTY_CELL_PERCENT
      : MIN_PLAYED_PERCENT + level * (100 - MIN_PLAYED_PERCENT);
  return `color-mix(in oklab, var(--primary) ${Math.round(percent)}%, transparent)`;
}

function cellLabel(weekday: number, hour: number): string {
  const count = grid.value[weekday][hour];
  return $t("statistics_activity_cell", count, {
    named: {
      weekday: longWeekdays.value[weekday],
      hour: hourLabels.value[hour],
      count: formatCount(count, locale.value),
    },
  });
}
</script>
