<template>
  <BaseChartCard
    :title="title"
    :loading="loading"
    :is-empty="!data || data.length === 0"
  >
    <PolarArea
      :data="chartData"
      :options="chartOptions"
      role="img"
      :aria-label="accessibleSummary"
    />
  </BaseChartCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PolarArea } from "vue-chartjs";
import { useTheme } from "vuetify";
import {
  Chart as ChartJS,
  RadialLinearScale,
  ArcElement,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import BaseChartCard from "./BaseChartCard.vue";
import { createTooltipConfig } from "./chartConfig";
import { $t } from "@/plugins/i18n";

ChartJS.register(RadialLinearScale, ArcElement, Tooltip, Legend);

import type { StatisticsHeatmapPoint } from "@/plugins/api/interfaces";

interface Props {
  title: string;
  data: StatisticsHeatmapPoint[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});
const theme = useTheme();

// Aggregate by hour across all days
const hourlyData = computed(() => {
  const hourCounts = Array.from({ length: 24 }, () => 0);

  props.data.forEach((point) => {
    if (point.hour >= 0 && point.hour < 24) {
      hourCounts[point.hour] += point.value;
    }
  });

  return hourCounts;
});

const accessibleSummary = computed(() =>
  $t("statistics_chart_accessible_summary", {
    title: props.title,
    values: hourlyData.value
      .map((plays, hour) => `${hour}:00: ${plays} ${$t("plays")}`)
      .join(", "),
  }),
);

const chartData = computed<ChartData<"polarArea">>(() => {
  const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);

  // Create gradient colors from midnight to midnight (MA color palette)
  const colors = hourlyData.value.map((_, index) => {
    const ratio = index / 24;
    const alpha = (value: number) => Math.min(1, Math.max(0, value));
    if (ratio < 0.25) {
      // Night (0-6): Purple to Indigo
      return `rgba(156, 39, 176, ${alpha(0.6 + ratio * 1.6)})`;
    } else if (ratio < 0.5) {
      // Morning (6-12): Primary Blue to Light Green
      return `rgba(3, 169, 244, ${alpha(0.6 + ratio)})`;
    } else if (ratio < 0.75) {
      // Afternoon (12-18): Green to Amber
      return `rgba(76, 175, 80, ${alpha(0.6 + ratio)})`;
    } else {
      // Evening (18-24): Amber to Teal
      return `rgba(0, 150, 136, ${alpha(0.6 + ratio * 0.4)})`;
    }
  });

  return {
    labels: hours,
    datasets: [
      {
        data: hourlyData.value,
        backgroundColor: colors,
        borderWidth: 0,
      },
    ],
  };
});

const chartOptions = computed<ChartOptions<"polarArea">>(() => ({
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: createTooltipConfig({
      label: (context) => `${Number(context.raw)} ${$t("plays")}`,
    }),
  },
  scales: {
    r: {
      beginAtZero: true,
      ticks: {
        display: false,
      },
      grid: {
        color: theme.current.value.dark
          ? "rgba(255, 255, 255, 0.16)"
          : "rgba(0, 0, 0, 0.12)",
      },
      pointLabels: {
        color: theme.current.value.colors.fg,
        font: {
          size: 11,
          family: "system-ui, -apple-system, sans-serif",
        },
      },
    },
  },
}));
</script>

<style scoped></style>
