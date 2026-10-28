<template>
  <StatisticsCard
    :title="$t('statistics_release_years')"
    :loading="loading"
    :error="error"
    :empty="!topDecade"
    :empty-text="$t('statistics_decade_empty')"
  >
    <span class="text-[22px] font-bold">
      {{ $t("statistics_mostly_decade", { decade: topDecade?.name ?? "" }) }}
    </span>
    <ChartContainer
      :config="chartConfig"
      class="aspect-auto h-[112px]"
      role="img"
      :aria-label="accessibleLabel"
    >
      <VisXYContainer :data="decadeData" :y-domain="[0, undefined]">
        <VisGroupedBar
          :x="(_: DecadeDatum, index: number) => index"
          :y="(datum: DecadeDatum) => datum.plays"
          :color="barColor"
          :rounded-corners="BAR_RADIUS"
          :bar-padding="BAR_PADDING"
        />
        <VisAxis
          type="x"
          :tick-values="tickValues"
          :tick-format="(index: number) => decadeData[index]?.label ?? ''"
          :tick-line="false"
          :domain-line="false"
          :grid-line="false"
        />
        <ChartTooltip />
        <ChartCrosshair :template="tooltipTemplate" color="transparent" />
      </VisXYContainer>
    </ChartContainer>
  </StatisticsCard>
</template>

<script setup lang="ts">
import StatisticsCard from "@/components/statistics/StatisticsCard.vue";
import {
  ChartContainer,
  ChartCrosshair,
  ChartTooltip,
  ChartTooltipContent,
  componentToString,
  type ChartConfig,
} from "@/components/ui/chart";
import { useCanonicalLocale } from "@/composables/useCanonicalLocale";
import {
  sharePercent,
  sortDecades,
  topEntry,
} from "@/helpers/statistics_rankings";
import type { StatisticsDistributionItem } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { VisAxis, VisGroupedBar, VisXYContainer } from "@unovis/vue";
import { computed } from "vue";

const props = defineProps<{
  decades: StatisticsDistributionItem[];
  loading?: boolean;
  error?: boolean;
}>();

interface DecadeDatum {
  label: string;
  plays: number;
  isTop: boolean;
}

const BAR_RADIUS = 6;
const BAR_PADDING = 0.15;

const chartConfig = {
  plays: { label: $t("statistics_plays_label"), color: "var(--primary)" },
} satisfies ChartConfig;
const locale = useCanonicalLocale();
const tooltipTemplate = componentToString(
  chartConfig,
  ChartTooltipContent,
  () => ({ labelKey: "label", locale: locale.value }),
);

const topDecade = computed(() => topEntry(props.decades));
const decadeData = computed<DecadeDatum[]>(() =>
  sortDecades(props.decades).map((decade) => ({
    label: decade.name,
    plays: decade.value,
    isTop: decade.name === topDecade.value?.name,
  })),
);
const tickValues = computed(() => decadeData.value.map((_, index) => index));

// the top decade in the primary colour, the others muted
const barColor = (datum: DecadeDatum) =>
  datum.isTop
    ? "var(--primary)"
    : "color-mix(in oklab, var(--primary) 30%, var(--muted))";

const accessibleLabel = computed(() => {
  const total = decadeData.value.reduce((sum, datum) => sum + datum.plays, 0);
  return $t("statistics_decades_accessible", {
    values: decadeData.value
      .map((datum) => `${datum.label} ${sharePercent(datum.plays, total)}%`)
      .join(", "),
  });
});
</script>
