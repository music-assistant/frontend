<template>
  <BaseChartCard
    :title="title"
    :loading="loading"
    :is-empty="!data || data.length === 0"
    :clickable="!!navigateTo"
  >
    <div class="pie-chart-wrapper">
      <div class="pie-chart-canvas">
        <Doughnut :data="chartData" :options="chartOptions" />
      </div>
      <div class="pie-chart-legend">
        <div
          v-for="(topItem, index) in data"
          :key="topItem.item.item_id"
          class="legend-item"
          @click="handleLegendClick(topItem)"
        >
          <div
            class="legend-color"
            :style="{
              backgroundColor: LASTFM_COLORS[index % LASTFM_COLORS.length],
            }"
          ></div>
          <div class="legend-image">
            <img
              :src="topItem.item.image?.path || placeholderImage"
              :alt="topItem.item.name"
              loading="lazy"
            />
          </div>
          <div class="legend-text">
            <div class="legend-name">{{ topItem.item.name }}</div>
            <div class="legend-value">
              <Play :size="14" />
              <span>{{ topItem.play_count }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseChartCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { Doughnut } from "vue-chartjs";
import { useTheme } from "vuetify";
import { Play } from "@lucide/vue";
import {
  imgCoverDark,
  imgCoverLight,
} from "@/components/QualityDetailsBtn.vue";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import BaseChartCard from "./BaseChartCard.vue";
import {
  LASTFM_COLORS,
  createTooltipConfig,
  createLegendConfig,
} from "./chartConfig";
import type { TopItemResult } from "@/plugins/api/interfaces";

ChartJS.register(ArcElement, Tooltip, Legend);

interface Props {
  title: string;
  data: TopItemResult[];
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
  theme.current.value.dark ? imgCoverDark.href : imgCoverLight.href,
);

const handleChartClick = (
  event: MouseEvent,
  elements: Array<{ index: number }>,
) => {
  if (!elements.length || !props.navigateTo) return;

  const element = elements[0];
  const topItem = props.data[element.index];

  if (!topItem) return;

  if (props.navigateTo === "artist") {
    router.push({
      name: "artist",
      params: {
        provider: topItem.item.provider,
        itemId: topItem.item.item_id,
      },
    });
  }
};

const handleLegendClick = (topItem: TopItemResult) => {
  if (!props.navigateTo) return;

  if (props.navigateTo === "artist") {
    router.push({
      name: "artist",
      params: {
        provider: topItem.item.provider,
        itemId: topItem.item.item_id,
      },
    });
  }
};

const chartData = computed<ChartData<"doughnut">>(() => {
  return {
    labels: props.data.map((topItem) => topItem.item.name),
    datasets: [
      {
        data: props.data.map((topItem) => topItem.play_count),
        backgroundColor: LASTFM_COLORS.slice(0, props.data.length),
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

<style scoped>
.pie-chart-wrapper {
  display: flex;
  align-items: center;
  gap: 24px;
  width: 100%;
  height: 100%;
}

.pie-chart-canvas {
  flex: 0 0 180px;
  height: 180px;
}

.pie-chart-legend {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  max-height: 240px;
  padding-right: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.legend-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.05);
}

.legend-color {
  flex: 0 0 12px;
  height: 12px;
  border-radius: 50%;
}

.legend-image {
  flex: 0 0 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(var(--v-theme-on-surface), 0.1);
}

.legend-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.legend-text {
  flex: 1;
  min-width: 0;
}

.legend-name {
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.legend-value {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-top: 2px;
}
</style>
