<template>
  <div v-if="enabled" class="detail-hero-listening">
    <div v-if="failed" role="alert" class="text-sm">
      {{ $t("listening_history.load_failed") }}
      <button type="button" class="underline min-h-11" @click="refresh">
        {{ $t("listening_history.retry") }}
      </button>
    </div>
    <div
      v-else-if="loading && count === null"
      role="status"
      class="text-sm text-white/70"
    >
      {{ $t("loading") }}
    </div>
    <button
      v-else-if="count !== null"
      type="button"
      class="detail-hero-listening__button"
      aria-haspopup="dialog"
      :aria-label="`${countLabel}. ${$t('listening_history.title')}`"
      @click="open = true"
    >
      <span class="detail-hero-listening__count">
        <strong class="block font-medium">{{ countLabel }}</strong>
        <small class="block text-xs text-white/60">{{
          $t("listening_history.all_recorded")
        }}</small>
      </span>
      <span class="detail-hero-listening__trend">
        <StatisticsPlaysChart
          v-if="chartData.length"
          :data="chartData"
          compact
        />
        <small class="block text-xs text-white/60">{{
          $t("period_month")
        }}</small>
      </span>
      <span class="detail-hero-listening__link">
        <span>{{ $t("listening_history.title") }}</span
        ><ChevronRight :size="16" class="text-primary shrink-0" />
      </span>
    </button>
    <ListeningHistoryDialog
      v-if="open"
      v-model:open="open"
      v-model:period="period"
      :item="item"
      :entries="entries"
      :series="series"
      :loading="historyLoading"
      :failed="historyFailed"
      :has-more="hasMore"
      :loading-more="loadingMore"
      @load-more="loadMore"
      @retry="refreshHistory"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from "vue";
import { ChevronRight } from "@lucide/vue";
import ListeningHistoryDialog from "@/components/details/ListeningHistoryDialog.vue";
import StatisticsPlaysChart from "@/components/statistics/StatisticsPlaysChart.vue";
import { useCanonicalLocale } from "@/composables/useCanonicalLocale";
import { useItemListeningHistory } from "@/composables/useItemListeningHistory";
import { formatCount } from "@/helpers/statistics_format";
import { formatBucketLabel } from "@/helpers/statistics_time_series";
import { MediaType, type MediaItemType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

const props = defineProps<{ item: MediaItemType }>();
const {
  enabled,
  open,
  period,
  count,
  trend,
  entries,
  series,
  failed,
  historyFailed,
  hasMore,
  loading,
  historyLoading,
  loadingMore,
  loadMore,
  refresh,
  refreshHistory,
} = useItemListeningHistory(toRef(props, "item"));
const locale = useCanonicalLocale();
const countLabel = computed(() =>
  $t(
    props.item.media_type === MediaType.TRACK
      ? "listening_history.your_plays"
      : "listening_history.your_track_plays",
    count.value ?? 0,
    { named: { count: formatCount(count.value ?? 0, locale.value) } },
  ),
);
const chartData = computed(() =>
  trend.value.map((point) => ({
    plays: point.value,
    label: formatBucketLabel(point.timestamp, locale.value),
    axisLabel: "",
  })),
);
</script>

<style scoped>
.detail-hero-listening {
  min-width: 0;
  width: 100%;
}
.detail-hero-listening__button {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 8px;
  border-radius: 8px;
  text-align: left;
}
.detail-hero-listening__button:hover {
  background: rgb(255 255 255 / 0.05);
}
.detail-hero-listening__button:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.detail-hero-listening__count {
  font-size: 18px;
}
.detail-hero-listening__trend {
  display: block;
  width: 100%;
  min-width: 0;
}
.detail-hero-listening__link {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgb(255 255 255 / 0.7);
}
@media (max-width: 768px) {
  .detail-hero-listening__button {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 88px 16px;
    align-items: center;
    gap: 8px;
    padding: 12px 0;
    border-block: 1px solid rgb(255 255 255 / 0.15);
    border-radius: 0;
  }
  .detail-hero-listening__count {
    font-size: 15px;
  }
  .detail-hero-listening__link > span {
    display: none;
  }
}
</style>
