<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="grid-cols-1 max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
    >
      <DialogHeader>
        <DialogTitle>{{ $t("listening_history.title") }}</DialogTitle>
        <DialogDescription
          >{{ item.name }} ·
          {{ $t("listening_history.completed_plays") }}</DialogDescription
        >
      </DialogHeader>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>{{
          $t("listening_history.period_count", total, {
            named: { count: formatCount(total, locale) },
          })
        }}</span>
        <StatisticsPeriodSelect v-model="period" hide-label />
      </div>
      <div
        v-if="loading"
        role="status"
        class="py-8 text-center text-muted-foreground"
      >
        {{ $t("loading") }}
      </div>
      <div v-else-if="failed" role="alert" class="space-y-3 py-4">
        <p>{{ $t("listening_history.load_failed") }}</p>
        <Button variant="outline" @click="emit('retry')">{{
          $t("listening_history.retry")
        }}</Button>
      </div>
      <template v-else>
        <StatisticsPlaysChart v-if="chartData.length" :data="chartData" />
        <p v-if="!entries.length" class="py-6 text-muted-foreground">
          {{ $t("listening_history.empty") }}
        </p>
        <ol v-else class="divide-y">
          <li
            v-for="entry in entries"
            :key="entry.event_id"
            class="flex items-center gap-3 py-3"
          >
            <div class="size-10 shrink-0">
              <MediaItemThumb :item="entry" :size="40" />
            </div>
            <div class="min-w-0 flex-1">
              <span class="block break-words">{{ entry.name }}</span>
              <span
                v-if="entry.artists.length"
                class="block text-xs text-muted-foreground"
                >{{
                  entry.artists.map((artist) => artist.name).join(", ")
                }}</span
              >
              <time
                :datetime="new Date(entry.played_at * 1000).toISOString()"
                class="block text-xs text-muted-foreground"
                >{{ formatHistoryTimestamp(entry.played_at, locale) }}</time
              >
            </div>
          </li>
        </ol>
        <Button
          v-if="hasMore"
          variant="outline"
          :loading="loadingMore"
          :disabled="loadingMore"
          class="mx-auto min-h-11"
          @click="emit('load-more')"
          >{{ $t("listening_history.load_more") }}</Button
        >
      </template>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import StatisticsPeriodSelect from "@/components/statistics/StatisticsPeriodSelect.vue";
import StatisticsPlaysChart from "@/components/statistics/StatisticsPlaysChart.vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCanonicalLocale } from "@/composables/useCanonicalLocale";
import {
  formatCount,
  formatHistoryTimestamp,
} from "@/helpers/statistics_format";
import {
  formatBucketAxisLabel,
  formatBucketLabel,
} from "@/helpers/statistics_time_series";
import type {
  MediaItemType,
  PlayHistoryItem,
  StatisticsPeriod,
  StatisticsTimeSeriesPoint,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

const props = defineProps<{
  item: MediaItemType;
  entries: PlayHistoryItem[];
  series: StatisticsTimeSeriesPoint[];
  loading: boolean;
  failed: boolean;
  hasMore: boolean;
  loadingMore: boolean;
}>();
const open = defineModel<boolean>("open", { required: true });
const period = defineModel<StatisticsPeriod>("period", { required: true });
const emit = defineEmits<{ "load-more": []; retry: [] }>();
const locale = useCanonicalLocale();
const total = computed(() =>
  props.series.reduce((sum, point) => sum + point.value, 0),
);
const chartData = computed(() =>
  props.series.map((point) => ({
    plays: point.value,
    label: formatBucketLabel(point.timestamp, locale.value),
    axisLabel: formatBucketAxisLabel(point.timestamp, locale.value),
  })),
);
</script>
