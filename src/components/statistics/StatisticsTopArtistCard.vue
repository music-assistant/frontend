<template>
  <StatisticsCard
    :title="$t('statistics_top_artist')"
    :loading="loading"
    :error="error"
    :empty="!topArtist"
  >
    <template v-if="topArtist">
      <div class="flex items-center gap-4">
        <div class="relative size-[112px] flex-none">
          <ChartContainer
            :config="chartConfig"
            class="aspect-square size-full"
            :style="donutStyle"
            role="img"
            :aria-label="accessibleLabel"
          >
            <VisSingleContainer :data="donutData">
              <VisDonut
                :value="(datum: DonutDatum) => datum.value"
                :color="(datum: DonutDatum) => chartConfig[datum.key].color"
                :arc-width="DONUT_ARC_WIDTH"
                :corner-radius="DONUT_CORNER_RADIUS"
                :show-background="false"
              />
            </VisSingleContainer>
          </ChartContainer>
          <div
            class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
            aria-hidden="true"
          >
            <span class="text-[22px] leading-tight font-bold text-foreground">
              {{ share }}%
            </span>
            <span class="text-[11px] font-medium text-muted-foreground">
              {{ $t("statistics_of_plays") }}
            </span>
          </div>
        </div>
        <div class="flex min-w-0 flex-col gap-1">
          <button
            type="button"
            class="line-clamp-3 border-0 bg-transparent p-0 text-left text-[22px] leading-tight font-bold wrap-anywhere text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            @click="openArtist"
          >
            {{ topArtist.item.name }}
          </button>
          <span class="text-[13px] text-muted-foreground">{{ detail }}</span>
        </div>
      </div>
      <Button
        class="max-w-full self-start"
        :disabled="!isAvailable"
        @click="playArtist"
      >
        <Play class="fill-current" aria-hidden="true" />
        <span class="truncate">
          {{ $t("statistics_play_item", { name: topArtist.item.name }) }}
        </span>
      </Button>
    </template>
  </StatisticsCard>
</template>

<script setup lang="ts">
import StatisticsCard from "@/components/statistics/StatisticsCard.vue";
import { Button } from "@/components/ui/button";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { useCanonicalLocale } from "@/composables/useCanonicalLocale";
import {
  handleMediaItemClick,
  handlePlayBtnClick,
} from "@/helpers/media_item_actions";
import { formatCount } from "@/helpers/statistics_format";
import { findListeningTime, sharePercent } from "@/helpers/statistics_rankings";
import { itemIsAvailable } from "@/plugins/api/helpers";
import type {
  StatisticsListeningTimeItem,
  StatisticsTopItemResult,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Play } from "@lucide/vue";
import { VisDonut, VisSingleContainer } from "@unovis/vue";
import { computed } from "vue";

const props = defineProps<{
  topArtists: StatisticsTopItemResult[];
  // all plays of the period
  totalPlays: number;
  listeningTime: StatisticsListeningTimeItem[];
  loading?: boolean;
  error?: boolean;
}>();

interface DonutDatum {
  key: "artist" | "rest";
  value: number;
}

const DONUT_ARC_WIDTH = 14;
// small enough that a short arc keeps its shape instead of turning into a blob
const DONUT_CORNER_RADIUS = 3;
const PERCENT = 100;

const chartConfig = {
  artist: { label: $t("artists"), color: "var(--primary)" },
  rest: { color: "var(--muted)" },
} satisfies ChartConfig;
const donutStyle = {
  // Unovis outlines each segment in white, which shows as lines on a dark card
  "--vis-donut-segment-stroke-width": "0",
};

const locale = useCanonicalLocale();
const topArtist = computed(() => props.topArtists[0]);
const isAvailable = computed(() =>
  topArtist.value ? itemIsAvailable(topArtist.value.item) : false,
);
const share = computed(() =>
  sharePercent(topArtist.value?.play_count ?? 0, props.totalPlays),
);
const donutData = computed<DonutDatum[]>(() => [
  { key: "artist", value: share.value },
  { key: "rest", value: PERCENT - share.value },
]);
const accessibleLabel = computed(() =>
  $t("statistics_top_artist_accessible", {
    name: topArtist.value?.item.name ?? "",
    share: share.value,
  }),
);
const detail = computed(() => {
  if (!topArtist.value) return "";
  const count = topArtist.value.play_count;
  const plays = $t("statistics_plays", count, {
    named: { count: formatCount(count, locale.value) },
  });
  const time = findListeningTime(topArtist.value.item, props.listeningTime);
  if (!time) return plays;
  const minutes = Math.round(time.minutes);
  const duration = $t("statistics_minutes", minutes, {
    named: { count: formatCount(minutes, locale.value) },
  });
  return `${plays} · ${duration}`;
});

function openArtist(event: MouseEvent): void {
  if (topArtist.value) {
    handleMediaItemClick(topArtist.value.item, event.clientX, event.clientY);
  }
}

function playArtist(event: MouseEvent): void {
  if (topArtist.value && isAvailable.value) {
    handlePlayBtnClick(topArtist.value.item, event.clientX, event.clientY);
  }
}
</script>
