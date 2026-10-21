<template>
  <BaseChartCard
    :title="title"
    :loading="loading"
    :is-empty="!data || data.length === 0"
    :empty-message="$t('statistics_decade_empty')"
  >
    <Bar
      :data="chartData"
      :options="chartOptions"
      :aria-label="accessibleSummary"
    />
  </BaseChartCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Bar } from "vue-chartjs";
import { useTheme } from "vuetify";
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
import { $t } from "@/plugins/i18n";
import {
  createTooltipConfig,
  createAxisConfig,
  CHART_COLORS,
} from "./chartConfig";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

import type { StatisticsDistributionItem } from "@/plugins/api/interfaces";

interface Props {
  title: string;
  data: StatisticsDistributionItem[];
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
      .map((item) => `${item.name}: ${item.value} ${$t("plays")}`)
      .join(", "),
  }),
);

const chartData = computed<ChartData<"bar">>(() => {
  return {
    labels: props.data.map((item) => item.name),
    datasets: [
      {
        label: $t("plays"),
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
        return `${plays} ${$t("plays")}`;
      },
    }),
  },
  scales: {
    x: {
      beginAtZero: true,
      ...createAxisConfig(
        "x",
        theme.current.value.colors.fg,
        theme.current.value.dark,
      ),
    },
    y: {
      ...createAxisConfig(
        "y",
        theme.current.value.colors.fg,
        theme.current.value.dark,
      ),
      grid: {
        display: false,
      },
    },
  },
}));
</script>

<style scoped></style>
