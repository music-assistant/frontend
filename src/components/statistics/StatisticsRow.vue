<template>
  <section class="ed-section space-y-4 px-7" :class="{ 'ed-dimmed': dimmed }">
    <div class="mb-3.5 flex items-start justify-between">
      <div class="flex flex-col gap-2">
        <h2
          class="m-0 text-[22px] font-bold text-[rgb(var(--v-theme-on-background))]"
        >
          {{ $t("statistics_charts") }}
        </h2>
        <div class="flex flex-wrap items-center gap-4">
          <Tabs
            :model-value="activeTab"
            class="mt-1 flex-1"
            @update:model-value="(value) => (activeTab = value as MediaType)"
          >
            <TabsList class="h-auto w-auto gap-4 bg-transparent p-0">
              <TabsTrigger
                v-for="tab in tabs"
                :key="tab.type"
                :value="tab.type"
                class="flex-none rounded-none border-0 bg-transparent px-1 pt-1 pb-2 text-[13px] text-muted-foreground shadow-none data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_-2px_0_0_currentColor] dark:data-[state=active]:bg-transparent"
              >
                {{ tab.label }}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <label class="sr-only" for="statistics-period">{{
            $t("statistics_period")
          }}</label>
          <NativeSelect
            id="statistics-period"
            v-model="period"
            class="w-auto cursor-pointer text-[13px]"
          >
            <NativeSelectOption value="today">{{
              $t("period_today")
            }}</NativeSelectOption>
            <NativeSelectOption value="week">{{
              $t("period_week")
            }}</NativeSelectOption>
            <NativeSelectOption value="month">{{
              $t("period_month")
            }}</NativeSelectOption>
            <NativeSelectOption value="year">{{
              $t("period_year")
            }}</NativeSelectOption>
            <NativeSelectOption value="all_time">{{
              $t("period_all_time")
            }}</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>
      <slot name="edit-controls"></slot>
    </div>

    <div
      class="ma-scroll overflow-x-auto overflow-y-hidden overscroll-x-contain"
    >
      <div
        v-if="loading"
        class="flex min-h-40 items-center justify-center p-10"
      >
        <Spinner class="size-8" />
      </div>
      <div
        v-else-if="error"
        class="p-10 text-center text-sm text-muted-foreground"
      >
        {{ $t("statistics_load_failed") }}
      </div>
      <div
        v-else-if="items.length === 0"
        class="p-10 text-center text-sm text-muted-foreground"
      >
        {{ $t("no_statistics_data") }}
      </div>
      <div v-else class="flex gap-2 pb-1">
        <ChartItem
          v-for="(item, index) in items"
          :key="item.item.uri"
          :item="item.item"
          :position="index + 1"
          :play-count="item.play_count"
        />
      </div>
    </div>

    <div class="ma-scroll mt-6 overflow-x-auto overscroll-x-contain pb-2">
      <div
        class="grid grid-cols-[repeat(2,minmax(320px,1fr))] gap-4 p-1 min-[1401px]:grid-cols-[repeat(4,minmax(320px,1fr))] max-[768px]:flex max-[768px]:gap-3"
      >
        <div class="col-span-2 min-w-[320px] max-[768px]:col-span-1">
          <PieChartCard
            :title="$t('artist_distribution')"
            :data="charts.artistDistribution"
            :loading="chartsLoading"
          />
        </div>
        <div class="min-w-[320px]">
          <LineChartCard
            :title="$t('plays_over_time')"
            :data="charts.playsOverTime"
            :period="period"
            :loading="chartsLoading"
          />
        </div>
        <div class="min-w-[320px]">
          <BarChartCard
            :title="$t('listening_time')"
            :data="charts.listeningTime"
            :loading="chartsLoading"
          />
        </div>
        <div class="min-w-[320px]">
          <ListeningClockCard
            :title="$t('listening_clock')"
            :data="charts.listeningActivity"
            :loading="chartsLoading"
          />
        </div>
        <div class="min-w-[320px]">
          <ListeningHeatmapCard
            :title="$t('listening_activity')"
            :data="charts.listeningActivity"
            :loading="chartsLoading"
          />
        </div>
        <div class="min-w-[320px]">
          <DecadeBarChartCard
            :title="$t('music_by_decade')"
            :data="charts.decadeDistribution"
            :loading="chartsLoading"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import ChartItem from "@/components/discover/ChartItem.vue";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MediaType,
  type StatisticsTopItemResult,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";
import BarChartCard from "./BarChartCard.vue";
import DecadeBarChartCard from "./DecadeBarChartCard.vue";
import LineChartCard from "./LineChartCard.vue";
import ListeningClockCard from "./ListeningClockCard.vue";
import ListeningHeatmapCard from "./ListeningHeatmapCard.vue";
import PieChartCard from "./PieChartCard.vue";
import type { StatisticsChartData } from "./statisticsRequests";

defineProps<{
  items: StatisticsTopItemResult[];
  charts: StatisticsChartData;
  loading: boolean;
  error: boolean;
  chartsLoading: boolean;
  dimmed?: boolean;
}>();

const activeTab = defineModel<MediaType>("activeTab", { required: true });
const period = defineModel<string>("period", { required: true });
const tabs = computed(() => [
  { type: MediaType.TRACK, label: $t("tracks") },
  { type: MediaType.ALBUM, label: $t("albums") },
  { type: MediaType.ARTIST, label: $t("artists") },
  { type: MediaType.PLAYLIST, label: $t("playlists") },
]);
</script>
