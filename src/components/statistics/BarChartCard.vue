<template>
  <BaseChartCard
    :title="title"
    :loading="loading"
    :is-empty="!data || data.length === 0"
    :empty-message="$t('statistics_listening_time_empty')"
    mobile-expanded
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

import type { StatisticsListeningTimeItem } from "@/plugins/api/interfaces";

interface Props {
  title: string;
  data: StatisticsListeningTimeItem[];
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
        (item) => `${item.name}: ${item.minutes} ${$t("statistics_minutes")}`,
      )
      .join(", "),
  }),
);

const chartData = computed<ChartData<"bar">>(() => {
  return {
    labels: props.data.map((item) => item.name),
    datasets: [
      {
        label: $t("statistics_minutes"),
        data: props.data.map((item) => item.minutes),
        backgroundColor: CHART_COLORS[0],
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };
});

const chartOptions = computed<ChartOptions<"bar">>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  layout: {
    padding: { left: 12, right: 8 },
  },
  indexAxis: "y",
  plugins: {
    legend: {
      display: false,
    },
    tooltip: createTooltipConfig({
      label: (context) => {
        const totalMinutes = Math.round(context.parsed.x ?? 0);
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        return hours > 0
          ? $t("duration_hours_minutes", { hours, minutes: mins })
          : $t("duration_minutes", { minutes: mins });
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
      ticks: {
        ...createAxisConfig(
          "x",
          theme.current.value.colors.fg,
          theme.current.value.dark,
        ).ticks,
        callback: (value) => {
          const minutes = Number(value);
          const hours = Math.floor(minutes / 60);
          return hours > 0
            ? $t("duration_hours", { hours })
            : $t("duration_minutes", { minutes });
        },
      },
    },
    y: {
      ...createAxisConfig(
        "y",
        theme.current.value.colors.fg,
        theme.current.value.dark,
      ),
      afterFit: (scale) => {
        scale.width = Math.max(scale.width, 160);
      },
      grid: {
        display: false,
      },
      ticks: {
        ...createAxisConfig(
          "y",
          theme.current.value.colors.fg,
          theme.current.value.dark,
        ).ticks,
        autoSkip: false,
        padding: 8,
      },
    },
  },
}));
</script>

<style scoped></style>
