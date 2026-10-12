<template>
  <BaseChartCard
    :title="title"
    :loading="loading"
    :is-empty="data.length === 0"
  >
    <div class="heatmap-scroll">
      <div class="activity-heatmap" role="img" :aria-label="title">
        <div class="activity-heatmap__axis">
          <span aria-hidden="true"></span>
          <div class="activity-heatmap__hours" aria-hidden="true">
            <span v-for="hour in hourLabels" :key="hour">{{ hour }}:00</span>
          </div>
        </div>
        <div
          v-for="(weekday, weekdayIndex) in weekdays"
          :key="weekdayIndex"
          class="activity-heatmap__row"
        >
          <span class="activity-heatmap__weekday">{{ weekday }}</span>
          <div class="activity-heatmap__cells">
            <span
              v-for="hour in hours"
              :key="hour"
              class="activity-heatmap__cell"
              :style="cellStyle(activity[weekdayIndex][hour])"
              :title="
                activityLabel(weekday, hour, activity[weekdayIndex][hour])
              "
              :aria-label="
                activityLabel(weekday, hour, activity[weekdayIndex][hour])
              "
            ></span>
          </div>
        </div>
      </div>
    </div>
  </BaseChartCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import BaseChartCard from "./BaseChartCard.vue";
import { $t } from "@/plugins/i18n";

interface HeatmapPoint {
  hour: number;
  weekday: number;
  value: number;
}

const props = withDefaults(
  defineProps<{
    title: string;
    data: HeatmapPoint[];
    loading?: boolean;
  }>(),
  { loading: false },
);

const hours = Array.from({ length: 24 }, (_, hour) => hour);
const hourLabels = [0, 6, 12, 18];
const weekdays = Array.from({ length: 7 }, (_, weekday) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2024, 0, weekday + 1))),
);

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

<style scoped>
.heatmap-scroll {
  width: 100%;
  overflow-x: auto;
}

.activity-heatmap {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 360px;
  width: 100%;
}

.activity-heatmap__axis,
.activity-heatmap__row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}

.activity-heatmap__hours {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 10px;
}

.activity-heatmap__hours span:not(:first-child) {
  text-align: center;
}

.activity-heatmap__hours span:last-child {
  text-align: right;
}

.activity-heatmap__weekday {
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-size: 11px;
}

.activity-heatmap__cells {
  display: grid;
  grid-template-columns: repeat(24, minmax(8px, 1fr));
  gap: 3px;
}

.activity-heatmap__cell {
  aspect-ratio: 1;
  border-radius: 2px;
}
</style>
