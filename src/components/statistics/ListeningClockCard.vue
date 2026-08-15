<template>
  <BaseChartCard
    :title="title"
    :loading="loading"
    :is-empty="!data || data.length === 0"
  >
    <PolarArea :data="chartData" :options="chartOptions" />
  </BaseChartCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PolarArea } from "vue-chartjs";
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

ChartJS.register(RadialLinearScale, ArcElement, Tooltip, Legend);

interface HeatmapPoint {
  hour: number;
  weekday: number;
  value: number;
}

interface Props {
  title: string;
  data: HeatmapPoint[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

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

const chartData = computed<ChartData<"polarArea">>(() => {
  const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);

  // Create gradient colors from midnight to midnight (MA color palette)
  const colors = hourlyData.value.map((_, index) => {
    const ratio = index / 24;
    if (ratio < 0.25) {
      // Night (0-6): Purple to Indigo
      return `rgba(156, 39, 176, ${0.6 + ratio * 1.6})`;
    } else if (ratio < 0.5) {
      // Morning (6-12): Primary Blue to Light Green
      return `rgba(3, 169, 244, ${0.6 + ratio})`;
    } else if (ratio < 0.75) {
      // Afternoon (12-18): Green to Amber
      return `rgba(76, 175, 80, ${0.6 + ratio})`;
    } else {
      // Evening (18-24): Amber to Teal
      return `rgba(0, 150, 136, ${0.6 + ratio * 0.4})`;
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
      label: (context) => {
        const value = context.parsed.r ?? context.parsed;
        return `${value} plays`;
      },
    }),
  },
  scales: {
    r: {
      beginAtZero: true,
      ticks: {
        display: false,
      },
      grid: {
        color: "rgba(var(--v-theme-on-surface), 0.1)",
      },
      pointLabels: {
        color: "rgb(var(--v-theme-on-surface))",
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
