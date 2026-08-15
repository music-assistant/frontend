<template>
  <BaseChartCard
    :title="title"
    :loading="loading"
    :is-empty="!data || data.length === 0"
  >
    <Bar :data="chartData" :options="chartOptions" />
  </BaseChartCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Bar } from "vue-chartjs";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import BaseChartCard from "./BaseChartCard.vue";
import {
  createTooltipConfig,
  createAxisConfig,
  LASTFM_COLORS,
} from "./chartConfig";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

interface ListeningTimeItem {
  name: string;
  minutes: number;
}

interface Props {
  title: string;
  data: ListeningTimeItem[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const chartData = computed<ChartData<"bar">>(() => {
  return {
    labels: props.data.map((item) => item.name),
    datasets: [
      {
        label: "Minutes",
        data: props.data.map((item) => item.minutes),
        backgroundColor: LASTFM_COLORS[0],
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };
});

const chartOptions = computed<ChartOptions<"bar">>(() => ({
  responsive: true,
  maintainAspectRatio: true,
  indexAxis: "y",
  plugins: {
    legend: {
      display: false,
    },
    tooltip: createTooltipConfig({
      label: (context) => {
        const minutes = context.parsed.x ?? 0;
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      },
    }),
  },
  scales: {
    x: {
      beginAtZero: true,
      ...createAxisConfig("x"),
      ticks: {
        ...createAxisConfig("x").ticks,
        callback: (value) => {
          const minutes = Number(value);
          const hours = Math.floor(minutes / 60);
          return hours > 0 ? `${hours}h` : `${minutes}m`;
        },
      },
    },
    y: {
      ...createAxisConfig("y"),
      grid: {
        display: false,
      },
    },
  },
}));
</script>

<style scoped></style>
