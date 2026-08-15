<template>
  <BaseChartCard
    :title="title"
    :loading="loading"
    :is-empty="!data || data.length === 0"
  >
    <Line :data="chartData" :options="chartOptions" />
  </BaseChartCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Line } from "vue-chartjs";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import BaseChartCard from "./BaseChartCard.vue";
import {
  createTooltipConfig,
  createAxisConfig,
  LASTFM_COLORS,
} from "./chartConfig";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
);

interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

interface Props {
  title: string;
  data: TimeSeriesPoint[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const chartData = computed<ChartData<"line">>(() => {
  return {
    labels: props.data.map((item) => item.timestamp),
    datasets: [
      {
        label: "Plays",
        data: props.data.map((item) => item.value),
        borderColor: LASTFM_COLORS[0],
        backgroundColor: "rgba(3, 169, 244, 0.15)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: LASTFM_COLORS[0],
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointHoverBorderWidth: 3,
        borderWidth: 3,
      },
    ],
  };
});

const chartOptions = computed<ChartOptions<"line">>(() => ({
  responsive: true,
  maintainAspectRatio: true,
  interaction: {
    mode: "index",
    intersect: false,
  },
  plugins: {
    legend: {
      display: false,
    },
    tooltip: createTooltipConfig(),
  },
  scales: {
    x: {
      ...createAxisConfig("x"),
      grid: {
        display: false,
      },
      ticks: {
        ...createAxisConfig("x").ticks,
        maxRotation: 45,
        minRotation: 0,
      },
    },
    y: {
      beginAtZero: true,
      ...createAxisConfig("y"),
      ticks: {
        ...createAxisConfig("y").ticks,
        precision: 0,
      },
    },
  },
}));
</script>

<style scoped></style>
