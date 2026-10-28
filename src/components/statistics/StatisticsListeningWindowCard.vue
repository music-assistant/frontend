<template>
  <StatisticsCard
    :title="$t('statistics_when_you_listen')"
    :loading="loading"
    :error="error"
    :empty="!peakWindow"
  >
    <template v-if="peakWindow">
      <div class="flex flex-col gap-1">
        <span class="text-[22px] font-bold">
          {{ $t(`statistics_profile_${peakWindow.profile}`) }}
        </span>
        <span class="text-[13px] text-muted-foreground">
          {{
            $t("statistics_window_share", {
              share: peakWindow.share,
              start: windowStart,
              end: windowEnd,
            })
          }}
        </span>
      </div>
      <ChartContainer
        :config="chartConfig"
        class="aspect-auto h-[96px]"
        role="img"
        :aria-label="accessibleLabel"
      >
        <VisXYContainer :data="hourData" :y-domain="[0, undefined]">
          <VisGroupedBar
            :x="(datum: HourDatum) => datum.hour"
            :y="(datum: HourDatum) => datum.plays"
            :color="barColor"
            :rounded-corners="BAR_RADIUS"
            :bar-padding="BAR_PADDING"
          />
          <VisAxis
            type="x"
            :tick-values="AXIS_HOURS"
            :tick-format="(hour: number) => formatHour(hour, locale)"
            :tick-line="false"
            :domain-line="false"
            :grid-line="false"
          />
          <ChartTooltip />
          <ChartCrosshair :template="tooltipTemplate" color="transparent" />
        </VisXYContainer>
      </ChartContainer>
    </template>
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
  hourlyTotals,
  isHourInWindow,
  peakListeningWindow,
} from "@/helpers/statistics_activity";
import { formatHour } from "@/helpers/statistics_format";
import type { StatisticsHeatmapPoint } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { VisAxis, VisGroupedBar, VisXYContainer } from "@unovis/vue";
import { computed } from "vue";

const props = defineProps<{
  activity: StatisticsHeatmapPoint[];
  loading?: boolean;
  error?: boolean;
}>();

interface HourDatum {
  hour: number;
  plays: number;
  label: string;
  inWindow: boolean;
}

const AXIS_HOURS = [0, 6, 12, 18];
const BAR_RADIUS = 2;
const BAR_PADDING = 0.2;

// computed, so the tooltip label follows a change of language
const chartConfig = computed(
  () =>
    ({
      plays: { label: $t("statistics_plays_label"), color: "var(--primary)" },
    }) satisfies ChartConfig,
);
const locale = useCanonicalLocale();
const tooltipTemplate = componentToString(
  () => chartConfig.value,
  ChartTooltipContent,
  () => ({ labelKey: "label", locale: locale.value }),
);
const hourly = computed(() => hourlyTotals(props.activity));
const peakWindow = computed(() => peakListeningWindow(hourly.value));
const windowStart = computed(() =>
  peakWindow.value ? formatHour(peakWindow.value.startHour, locale.value) : "",
);
const windowEnd = computed(() =>
  peakWindow.value ? formatHour(peakWindow.value.endHour, locale.value) : "",
);
const hourData = computed<HourDatum[]>(() =>
  hourly.value.map((plays, hour) => ({
    hour,
    plays,
    label: formatHour(hour, locale.value),
    inWindow: peakWindow.value ? isHourInWindow(hour, peakWindow.value) : false,
  })),
);

// the peak window in the primary colour, the other hours muted
const barColor = (datum: HourDatum) =>
  datum.inWindow
    ? "var(--primary)"
    : "color-mix(in oklab, var(--muted-foreground) 45%, transparent)";

const accessibleLabel = computed(() =>
  $t("statistics_hourly_accessible", {
    start: windowStart.value,
    end: windowEnd.value,
  }),
);
</script>
