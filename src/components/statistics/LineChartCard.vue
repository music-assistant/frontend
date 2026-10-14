<template>
  <BaseChartCard
    :title="title"
    :loading="loading"
    :is-empty="!data || data.length === 0"
    :accessible-summary="accessibleSummary"
  >
    <Line :data="chartData" :options="chartOptions" />
  </BaseChartCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Line } from "vue-chartjs";
import { useTheme } from "vuetify";
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
import { $t } from "@/plugins/i18n";
import {
  createTooltipConfig,
  createAxisConfig,
  CHART_COLORS,
} from "./chartConfig";
import { formatPlaysOverTimeLabel } from "./statisticsRequests";

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
  period: string;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});
const theme = useTheme();

const accessibleSummary = computed(() =>
  $t("statistics_chart_accessible_summary", {
    title: props.title,
    values: props.data
      .map(
        (point) =>
          `${formatPlaysOverTimeLabel(point.timestamp, props.period)}: ${point.value} ${$t("plays")}`,
      )
      .join(", "),
  }),
);

const chartData = computed<ChartData<"line">>(() => {
  return {
    labels: props.data.map((item) =>
      formatPlaysOverTimeLabel(item.timestamp, props.period),
    ),
    datasets: [
      {
        label: $t("plays"),
        data: props.data.map((item) => item.value),
        borderColor: CHART_COLORS[0],
        backgroundColor: "rgba(3, 169, 244, 0.15)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: CHART_COLORS[0],
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
      ...createAxisConfig(
        "x",
        theme.current.value.colors.fg,
        theme.current.value.dark,
      ),
      grid: {
        display: false,
      },
      ticks: {
        ...createAxisConfig(
          "x",
          theme.current.value.colors.fg,
          theme.current.value.dark,
        ).ticks,
        maxRotation: 45,
        minRotation: 0,
      },
    },
    y: {
      beginAtZero: true,
      ...createAxisConfig(
        "y",
        theme.current.value.colors.fg,
        theme.current.value.dark,
      ),
      ticks: {
        ...createAxisConfig(
          "y",
          theme.current.value.colors.fg,
          theme.current.value.dark,
        ).ticks,
        precision: 0,
      },
    },
  },
}));
</script>

<style scoped></style>
