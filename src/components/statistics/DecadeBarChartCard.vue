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
  CHART_COLORS,
} from "./chartConfig";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

interface DistributionItem {
  name: string;
  value: number;
}

interface Props {
  title: string;
  data: DistributionItem[];
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
        label: "Plays",
        data: props.data.map((item) => item.value),
        backgroundColor: CHART_COLORS[0],
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
        const plays = context.parsed.x;
        return `${plays} plays`;
      },
    }),
  },
  scales: {
    x: {
      beginAtZero: true,
      ...createAxisConfig("x"),
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
