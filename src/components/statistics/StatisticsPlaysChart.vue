<template>
  <ChartContainer
    :config="chartConfig"
    class="aspect-auto h-[190px]"
    role="img"
    :aria-label="accessibleLabel"
  >
    <VisXYContainer
      :data="data"
      :svg-defs="svgDefs"
      :y-domain="[0, undefined]"
      :padding="{ top: 8 }"
    >
      <VisArea :x="x" :y="y" :color="`url(#${gradientId})`" />
      <VisLine :x="x" :y="y" :color="chartConfig.plays.color" :line-width="3" />
      <VisAxis
        type="x"
        :x="x"
        :tick-values="tickValues"
        :tick-format="tickFormat"
        :tick-line="false"
        :domain-line="false"
        :grid-line="false"
      />
      <ChartTooltip />
      <ChartCrosshair
        :template="tooltipTemplate"
        :color="chartConfig.plays.color"
      />
    </VisXYContainer>
  </ChartContainer>
</template>

<script setup lang="ts">
import {
  ChartContainer,
  ChartCrosshair,
  ChartTooltip,
  ChartTooltipContent,
  componentToString,
  type ChartConfig,
} from "@/components/ui/chart";
import { evenlySpacedIndices } from "@/helpers/statistics_time_series";
import { $t } from "@/plugins/i18n";
import { VisArea, VisAxis, VisLine, VisXYContainer } from "@unovis/vue";
import { computed, useId } from "vue";

/** One bucket of the chart. */
export interface PlaysChartDatum {
  plays: number;
  // full label, for the tooltip and the accessible summary
  label: string;
  // short label, for the axis
  axisLabel: string;
}

const props = defineProps<{
  data: PlaysChartDatum[];
}>();

const MAX_AXIS_TICKS = 7;

const chartConfig = {
  plays: { label: $t("statistics_plays_label"), color: "var(--primary)" },
} satisfies ChartConfig;

const gradientId = `statistics-plays-${useId()}`;
const svgDefs = `
  <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="var(--color-plays)" stop-opacity="0.55" />
    <stop offset="100%" stop-color="var(--color-plays)" stop-opacity="0" />
  </linearGradient>
`;

const x = (_: PlaysChartDatum, index: number) => index;
const y = (datum: PlaysChartDatum) => datum.plays;
const tickValues = computed(() =>
  evenlySpacedIndices(props.data.length, MAX_AXIS_TICKS),
);
const tickFormat = (index: number) => props.data[index]?.axisLabel ?? "";
const tooltipTemplate = componentToString(chartConfig, ChartTooltipContent, {
  labelKey: "label",
});

const accessibleLabel = computed(() =>
  $t("statistics_chart_accessible_summary", {
    title: $t("statistics_plays_over_time"),
    values: props.data
      .filter((datum) => datum.plays > 0)
      .map((datum) => `${datum.label}: ${datum.plays}`)
      .join(", "),
  }),
);
</script>
