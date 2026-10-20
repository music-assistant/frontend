import {
  createLatestRequestGate,
  getPlaysOverTimeGranularity,
  loadStatisticsChartData,
  type StatisticsChartData,
} from "@/components/statistics/statisticsRequests";
import api from "@/plugins/api";
import {
  EventType,
  MediaType,
  type EventMessage,
  type PlaylogUpdate,
  type StatisticsTopItemResult,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { computed, onScopeDispose, ref, watch, type Ref } from "vue";
import { toast } from "vue-sonner";

const TOP_ITEMS_LIMIT = 50;
const CHART_ITEMS_LIMIT = 10;
const STATISTICS_LOAD_ERROR_TOAST_ID = "statistics-load-failed";

function notifyStatisticsLoadError(): void {
  toast.error($t("statistics_load_failed"), {
    id: STATISTICS_LOAD_ERROR_TOAST_ID,
  });
}

export function useStatistics(visible: Readonly<Ref<boolean>>) {
  const activeStatTab = ref<MediaType>(MediaType.TRACK);
  const activeStatPeriod = ref("week");
  const statisticsItems = ref<StatisticsTopItemResult[]>([]);
  const statisticsLoading = ref(false);
  const statisticsError = ref(false);
  const artistDistribution = ref<StatisticsChartData["artistDistribution"]>([]);
  const playsOverTime = ref<StatisticsChartData["playsOverTime"]>([]);
  const listeningActivity = ref<StatisticsChartData["listeningActivity"]>([]);
  const listeningTime = ref<StatisticsChartData["listeningTime"]>([]);
  const decadeDistribution = ref<StatisticsChartData["decadeDistribution"]>([]);
  const chartsLoading = ref(false);
  const statisticsRequests = createLatestRequestGate();
  const chartRequests = createLatestRequestGate();
  let disposed = false;

  async function loadStatistics(): Promise<void> {
    const generation = statisticsRequests.begin();
    const mediaType = activeStatTab.value;
    const period = activeStatPeriod.value;
    const isCurrent = () =>
      !disposed &&
      visible.value &&
      statisticsRequests.isCurrent(generation) &&
      mediaType === activeStatTab.value &&
      period === activeStatPeriod.value;
    statisticsItems.value = [];
    statisticsError.value = false;
    statisticsLoading.value = true;
    try {
      const result = await api.getTopItems(mediaType, period, TOP_ITEMS_LIMIT);
      if (!isCurrent()) return;
      statisticsItems.value = result.filter((item) => item && item.item);
    } catch {
      if (!isCurrent()) return;
      notifyStatisticsLoadError();
      statisticsItems.value = [];
      statisticsError.value = true;
    } finally {
      if (isCurrent()) statisticsLoading.value = false;
    }
  }

  async function loadCharts(): Promise<void> {
    const generation = chartRequests.begin();
    const period = activeStatPeriod.value;
    const isCurrent = () =>
      !disposed &&
      visible.value &&
      chartRequests.isCurrent(generation) &&
      period === activeStatPeriod.value;
    chartsLoading.value = true;
    try {
      const { data, hasFailures } = await loadStatisticsChartData({
        artistDistribution: api.getTopItems(
          MediaType.ARTIST,
          period,
          CHART_ITEMS_LIMIT,
        ),
        playsOverTime: api.getPlaysOverTime(
          period,
          getPlaysOverTimeGranularity(period),
        ),
        listeningActivity: api.getListeningActivity(period),
        listeningTime: api.getListeningTime(
          period,
          "artist",
          CHART_ITEMS_LIMIT,
        ),
        decadeDistribution: api.getDecadeDistribution(
          period,
          CHART_ITEMS_LIMIT,
        ),
      });
      if (!isCurrent()) return;
      artistDistribution.value = data.artistDistribution;
      playsOverTime.value = data.playsOverTime;
      listeningActivity.value = data.listeningActivity;
      listeningTime.value = data.listeningTime;
      decadeDistribution.value = data.decadeDistribution;
      if (hasFailures) {
        console.error("One or more statistics chart requests failed.");
        notifyStatisticsLoadError();
      }
    } finally {
      if (isCurrent()) chartsLoading.value = false;
    }
  }

  function invalidate(): void {
    statisticsRequests.invalidate();
    chartRequests.invalidate();
    statisticsLoading.value = false;
    chartsLoading.value = false;
  }

  function refresh(): void {
    if (disposed || !visible.value) return;
    void loadStatistics();
    void loadCharts();
  }

  watch(
    [visible, activeStatTab, activeStatPeriod],
    ([isVisible, mediaType, period], previous) => {
      if (!isVisible) {
        invalidate();
        return;
      }
      const [wasVisible, previousMediaType, previousPeriod] = previous ?? [];
      if (
        !wasVisible ||
        mediaType !== previousMediaType ||
        period !== previousPeriod
      ) {
        void loadStatistics();
      }
      if (!wasVisible || period !== previousPeriod) void loadCharts();
    },
    { immediate: true },
  );

  const unsubscribe = api.subscribe(
    EventType.PLAYLOG_UPDATED,
    (event: EventMessage) => {
      const update = event.data as PlaylogUpdate | undefined;
      if (update?.userid && update.userid !== store.currentUser?.user_id)
        return;
      if (update?.fully_played) refresh();
    },
  );

  onScopeDispose(() => {
    disposed = true;
    invalidate();
    unsubscribe();
  });

  return {
    chartData: computed<StatisticsChartData>(() => ({
      artistDistribution: artistDistribution.value,
      playsOverTime: playsOverTime.value,
      listeningActivity: listeningActivity.value,
      listeningTime: listeningTime.value,
      decadeDistribution: decadeDistribution.value,
    })),
    activeStatTab,
    activeStatPeriod,
    statisticsItems,
    statisticsLoading,
    statisticsError,
    artistDistribution,
    playsOverTime,
    listeningActivity,
    listeningTime,
    decadeDistribution,
    chartsLoading,
    refresh,
  };
}
