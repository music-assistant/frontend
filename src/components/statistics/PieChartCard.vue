<template>
  <BaseChartCard
    :title="title"
    :loading="loading"
    :is-empty="!data || data.length === 0"
    :clickable="!!navigateTo"
    :accessible-summary="accessibleSummary"
    mobile-expanded
  >
    <div
      class="flex h-full w-full items-center gap-6 max-[600px]:flex-col max-[600px]:justify-start"
    >
      <div
        class="size-[180px] shrink-0 max-[600px]:size-[132px] max-[600px]:self-center"
      >
        <Doughnut :data="chartData" :options="chartOptions" />
      </div>
      <div
        class="flex max-h-[240px] min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-2 max-[600px]:max-h-[420px] max-[600px]:w-full"
      >
        <button
          v-for="(topItem, index) in data"
          :key="topItem.item.uri"
          type="button"
          class="flex w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent p-2 text-left text-inherit transition-colors hover:bg-[rgba(var(--v-theme-on-surface),0.05)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default disabled:hover:bg-transparent"
          :aria-label="topItem.item.name"
          :disabled="!navigateTo"
          @click="navigateToItem(topItem)"
        >
          <div
            class="size-3 shrink-0 rounded-full"
            :style="{
              backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
            }"
          ></div>
          <div
            class="size-10 shrink-0 overflow-hidden rounded-full bg-[rgba(var(--v-theme-on-surface),0.1)]"
          >
            <img
              class="size-full object-cover"
              :src="getImageThumbForItem(topItem.item) || placeholderImage"
              :alt="topItem.item.name"
              loading="lazy"
            />
          </div>
          <div class="min-w-0 flex-1">
            <div
              class="truncate text-[13px] font-semibold text-[rgb(var(--v-theme-on-surface))]"
            >
              {{ topItem.item.name }}
            </div>
            <div
              class="mt-0.5 flex items-center gap-1 text-[11px] text-[rgba(var(--v-theme-on-surface),0.6)]"
            >
              <Play :size="14" />
              <span>{{ topItem.play_count }}</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  </BaseChartCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { Doughnut } from "vue-chartjs";
import { $t } from "@/plugins/i18n";
import { useTheme } from "vuetify";
import { Play } from "@lucide/vue";
import {
  imgCoverDark,
  imgCoverLight,
} from "@/components/QualityDetailsBtn.vue";
import { getImageThumbForItem } from "@/helpers/utils";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import BaseChartCard from "./BaseChartCard.vue";
import { CHART_COLORS, createTooltipConfig } from "./chartConfig";
import type { StatisticsTopItemResult } from "@/plugins/api/interfaces";

ChartJS.register(ArcElement, Tooltip, Legend);

interface Props {
  title: string;
  data: StatisticsTopItemResult[];
  loading?: boolean;
  navigateTo?: "artist" | "genre" | null;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  navigateTo: "artist",
});

const router = useRouter();
const theme = useTheme();

const placeholderImage = computed(() =>
  theme.current.value.dark ? imgCoverDark : imgCoverLight,
);

const accessibleSummary = computed(() =>
  $t("statistics_chart_accessible_summary", {
    title: props.title,
    values: props.data
      .map(
        (topItem) =>
          `${topItem.item.name}: ${topItem.play_count} ${$t("plays")}`,
      )
      .join(", "),
  }),
);

const handleChartClick = (
  event: unknown,
  elements: Array<{ index: number }>,
) => {
  if (!elements.length) return;
  navigateToItem(props.data[elements[0].index]);
};

const navigateToItem = (topItem: StatisticsTopItemResult | undefined) => {
  if (!topItem || props.navigateTo !== "artist") return;
  router.push({
    name: "artist",
    params: {
      provider: topItem.item.provider,
      itemId: topItem.item.item_id,
    },
  });
};

const chartData = computed<ChartData<"doughnut">>(() => {
  return {
    labels: props.data.map((topItem) => topItem.item.name),
    datasets: [
      {
        data: props.data.map((topItem) => topItem.play_count),
        backgroundColor: CHART_COLORS.slice(0, props.data.length),
        borderWidth: 0,
        hoverBorderWidth: 0,
        hoverOffset: 12,
        borderRadius: 4,
        spacing: 2,
      },
    ],
  };
});

const chartOptions = computed<ChartOptions<"doughnut">>(() => ({
  responsive: true,
  maintainAspectRatio: true,
  cutout: "65%",
  onClick: props.navigateTo ? handleChartClick : undefined,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: createTooltipConfig({
      label: (context) => {
        const value = context.parsed;
        const total = context.dataset.data.reduce(
          (a: number, b: number) => a + b,
          0,
        );
        const percentage = ((value / total) * 100).toFixed(1);
        return `${context.label}: ${value} (${percentage}%)`;
      },
    }),
  },
}));
</script>
