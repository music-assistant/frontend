import {
  computed,
  onScopeDispose,
  ref,
  shallowRef,
  watch,
  type Ref,
} from "vue";
import { toast } from "vue-sonner";
import { useLatestLoad } from "@/composables/useStatistics";
import { useUserPreferences } from "@/composables/userPreferences";
import {
  getPlaysOverTimeGranularity,
  groupLongHistoryByYear,
} from "@/helpers/statistics_time_series";
import api from "@/plugins/api";
import {
  MediaType,
  type MediaItemType,
  type PlayHistoryItem,
  type StatisticsItemFilter,
  type StatisticsPeriod,
  type StatisticsTimeSeriesPoint,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";

export const HISTORY_PAGE_SIZE = 20;
export const LISTENING_HISTORY_PREFERENCE = "listeningHistory";

/** Personal completed plays for the shown item, loaded only while their UI is visible. */
export function useItemListeningHistory(item: Readonly<Ref<MediaItemType>>) {
  const { getPreference } = useUserPreferences();
  const preferences = getPreference<Partial<Record<MediaType, boolean>>>(
    LISTENING_HISTORY_PREFERENCE,
    {},
  );
  const enabled = computed(
    () =>
      !!store.currentUser && preferences.value[item.value.media_type] !== false,
  );
  const filter = computed<StatisticsItemFilter>(() => {
    const { item_id, provider, media_type } = item.value;
    if (
      media_type !== MediaType.TRACK &&
      media_type !== MediaType.ALBUM &&
      media_type !== MediaType.ARTIST
    ) {
      throw new Error("Listening history requires a track, album or artist");
    }
    return { item_id, provider, media_type };
  });
  const key = () => `${store.currentUser?.user_id}:${item.value.uri}`;
  const open = ref(false);
  const period = ref<StatisticsPeriod>("month");
  const count = ref<number | null>(null);
  const trend = shallowRef<StatisticsTimeSeriesPoint[]>([]);
  const entries = shallowRef<PlayHistoryItem[]>([]);
  const series = shallowRef<StatisticsTimeSeriesPoint[]>([]);
  const failed = ref(false);
  const historyFailed = ref(false);
  const hasMore = ref(false);
  const loadingMore = ref(false);
  let pageGeneration = 0;
  onScopeDispose(() => {
    pageGeneration++;
  });
  watch(open, () => {
    pageGeneration++;
    loadingMore.value = false;
  });

  watch([key, period, enabled], () => {
    pageGeneration++;
    loadingMore.value = false;
    entries.value = [];
    series.value = [];
    hasMore.value = false;
  });
  watch(key, () => {
    count.value = null;
    trend.value = [];
    open.value = false;
  });
  watch(enabled, (value) => {
    if (!value) open.value = false;
  });

  const hero = useLatestLoad({
    active: enabled,
    key,
    request: () =>
      Promise.allSettled([
        api.getPlayCount(filter.value),
        api.getPlaysOverTime("month", "day", {}, filter.value),
      ]),
    apply: ([total, points]) => {
      count.value = total.status === "fulfilled" ? total.value : null;
      trend.value = points.status === "fulfilled" ? points.value : [];
      failed.value =
        total.status === "rejected" || points.status === "rejected";
      return failed.value;
    },
  });
  const history = useLatestLoad({
    active: computed(() => open.value && enabled.value),
    key: () => `${key()}:${period.value}`,
    request: () =>
      Promise.allSettled([
        api.getPlayHistory(filter.value, period.value, HISTORY_PAGE_SIZE + 1),
        api.getPlaysOverTime(
          period.value,
          getPlaysOverTimeGranularity(period.value),
          {},
          filter.value,
        ),
      ]),
    apply: ([plays, points]) => {
      pageGeneration++;
      loadingMore.value = false;
      entries.value =
        plays.status === "fulfilled"
          ? plays.value.slice(0, HISTORY_PAGE_SIZE)
          : [];
      hasMore.value =
        plays.status === "fulfilled" && plays.value.length > HISTORY_PAGE_SIZE;
      series.value =
        points.status === "fulfilled"
          ? groupLongHistoryByYear(points.value, period.value)
          : [];
      historyFailed.value =
        plays.status === "rejected" || points.status === "rejected";
      return historyFailed.value;
    },
  });

  async function loadMore(): Promise<void> {
    if (loadingMore.value || !hasMore.value || !open.value) return;
    const generation = ++pageGeneration;
    loadingMore.value = true;
    try {
      const next = await api.getPlayHistory(
        filter.value,
        period.value,
        HISTORY_PAGE_SIZE + 1,
        entries.value.length,
      );
      if (generation !== pageGeneration || !open.value) return;
      const known = new Set(entries.value.map((entry) => entry.event_id));
      entries.value = [
        ...entries.value,
        ...next
          .slice(0, HISTORY_PAGE_SIZE)
          .filter((entry) => !known.has(entry.event_id)),
      ];
      hasMore.value = next.length > HISTORY_PAGE_SIZE;
    } catch {
      if (generation === pageGeneration)
        toast.error($t("listening_history.load_failed"));
    } finally {
      if (generation === pageGeneration) loadingMore.value = false;
    }
  }

  return {
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
    loading: hero.loading,
    historyLoading: history.loading,
    loadingMore,
    loadMore,
    refresh: hero.refresh,
    refreshHistory: history.refresh,
  };
}
