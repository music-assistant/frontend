import {
  fillPlaysOverTimeGaps,
  getPlaysOverTimeGranularity,
} from "@/helpers/statistics_time_series";
import api, { ConnectionState } from "@/plugins/api";
import {
  EventType,
  MediaType,
  type EventMessage,
  type PlaylogUpdate,
  type StatisticsDistributionItem,
  type StatisticsHeatmapPoint,
  type StatisticsListeningTimeItem,
  type StatisticsPeriod,
  type StatisticsTimeSeriesPoint,
  type StatisticsTopItemResult,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { onScopeDispose, ref, shallowRef, watch, type Ref } from "vue";
import { toast } from "vue-sonner";

/** Rows in the top items table. */
export const TOP_ITEMS_LIMIT = 50;
/** Artists ranked for the number one card and to link listening time rows. */
export const TOP_ARTISTS_LIMIT = 10;
/** Entries asked for from the distribution and listening time commands. */
export const DISTRIBUTION_LIMIT = 10;
/** Waits for a burst of finished tracks to settle before refreshing. */
export const PLAYLOG_REFRESH_DEBOUNCE_MS = 5000;
const LOAD_FAILED_TOAST_ID = "statistics-load-failed";

/** Everything the statistics views show for one period. */
export interface StatisticsData {
  // gap-filled over the whole period
  playsOverTime: StatisticsTimeSeriesPoint[];
  topTracks: StatisticsTopItemResult[];
  topArtists: StatisticsTopItemResult[];
  listeningActivity: StatisticsHeatmapPoint[];
  listeningTime: StatisticsListeningTimeItem[];
  genreDistribution: StatisticsDistributionItem[];
  decadeDistribution: StatisticsDistributionItem[];
}

export type StatisticsSection = keyof StatisticsData;

type StatisticsRequests = {
  [Section in StatisticsSection]: (
    period: StatisticsPeriod,
  ) => Promise<StatisticsData[Section]>;
};

const REQUESTS: StatisticsRequests = {
  playsOverTime: async (period) =>
    fillPlaysOverTimeGaps(
      await api.getPlaysOverTime(period, getPlaysOverTimeGranularity(period)),
      period,
    ),
  topTracks: (period) =>
    api.getTopItems(MediaType.TRACK, period, TOP_ITEMS_LIMIT),
  topArtists: (period) =>
    api.getTopItems(MediaType.ARTIST, period, TOP_ARTISTS_LIMIT),
  listeningActivity: (period) => api.getListeningActivity(period),
  listeningTime: (period) =>
    api.getListeningTime(period, "artist", DISTRIBUTION_LIMIT),
  genreDistribution: (period) =>
    api.getGenreDistribution(period, DISTRIBUTION_LIMIT),
  decadeDistribution: (period) =>
    api.getDecadeDistribution(period, DISTRIBUTION_LIMIT),
};

const emptyData = (): StatisticsData => ({
  playsOverTime: [],
  topTracks: [],
  topArtists: [],
  listeningActivity: [],
  listeningTime: [],
  genreDistribution: [],
  decadeDistribution: [],
});

interface LatestLoadOptions<Result> {
  active: Readonly<Ref<boolean>>;
  // what is loaded; a change is a user's choice, such as a new period
  key: () => string;
  request: () => Promise<Result>;
  // stores a result and tells whether any part of it failed
  apply: (result: Result) => boolean;
}

/**
 * Loads statistics while `active` and connected, again when the key changes
 * and, debounced, when the current user finishes a track. Only the latest
 * request is applied. A failure toasts only when the user changed the key;
 * views show their own inline error for every failure.
 */
function useLatestLoad<Result>(options: LatestLoadOptions<Result>) {
  const loading = ref(false);
  let generation = 0;
  let disposed = false;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;

  const canLoad = () =>
    !disposed &&
    options.active.value &&
    api.state.value === ConnectionState.INITIALIZED;

  async function load(userTriggered: boolean): Promise<void> {
    const current = ++generation;
    if (!canLoad()) {
      loading.value = false;
      return;
    }
    const isCurrent = () => current === generation && canLoad();
    loading.value = true;
    try {
      const result = await options.request();
      if (!isCurrent()) return;
      if (options.apply(result) && userTriggered) {
        toast.error($t("statistics_load_failed"), { id: LOAD_FAILED_TOAST_ID });
      }
    } finally {
      if (current === generation) loading.value = false;
    }
  }

  watch(
    [options.key, options.active, () => api.state.value],
    // the first run has no previous key, so only a later change is the user's
    ([key], previous) => {
      const previousKey: string | undefined = previous?.[0];
      void load(previousKey !== undefined && key !== previousKey);
    },
    { immediate: true },
  );

  const unsubscribe = api.subscribe(
    EventType.PLAYLOG_UPDATED,
    (event: EventMessage) => {
      const update = event.data as PlaylogUpdate | undefined;
      if (!update?.fully_played) return;
      if (update.userid && update.userid !== store.currentUser?.user_id) return;
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(
        () => void load(false),
        PLAYLOG_REFRESH_DEBOUNCE_MS,
      );
    },
  );

  onScopeDispose(() => {
    disposed = true;
    generation++;
    clearTimeout(refreshTimer);
    unsubscribe();
  });

  return { loading, refresh: () => load(false) };
}

interface UseStatisticsOptions {
  active: Readonly<Ref<boolean>>;
  period: Readonly<Ref<StatisticsPeriod>>;
  // only these are requested; the rest stay empty
  sections: readonly StatisticsSection[];
}

/** The statistics of a period, each section requested in parallel. */
export function useStatistics(options: UseStatisticsOptions) {
  const data = shallowRef<StatisticsData>(emptyData());
  const failed = shallowRef<ReadonlySet<StatisticsSection>>(new Set());

  const { loading, refresh } = useLatestLoad({
    active: options.active,
    key: () => options.period.value,
    request: () =>
      Promise.allSettled(
        options.sections.map((section) =>
          REQUESTS[section](options.period.value),
        ),
      ),
    apply: (results) => {
      const next = emptyData();
      const failures = new Set<StatisticsSection>();
      results.forEach((result, index) => {
        const section = options.sections[index];
        if (result.status === "fulfilled") {
          (next as Record<StatisticsSection, unknown>)[section] = result.value;
        } else failures.add(section);
      });
      data.value = next;
      failed.value = failures;
      return failures.size > 0;
    },
  });

  return { data, failed, loading, refresh };
}

/** The type of items ranked in the top items table. */
export type TopItemsMediaType =
  MediaType.TRACK | MediaType.ALBUM | MediaType.ARTIST | MediaType.PLAYLIST;

interface UseStatisticsTopItemsOptions {
  active: Readonly<Ref<boolean>>;
  period: Readonly<Ref<StatisticsPeriod>>;
  mediaType: Readonly<Ref<TopItemsMediaType>>;
}

interface TopItemsResult {
  items: StatisticsTopItemResult[];
  error: boolean;
}

/** The most played items of one media type, for the top items table. */
export function useStatisticsTopItems(options: UseStatisticsTopItemsOptions) {
  const items = shallowRef<StatisticsTopItemResult[]>([]);
  const error = ref(false);

  const { loading, refresh } = useLatestLoad({
    active: options.active,
    key: () => `${options.period.value}:${options.mediaType.value}`,
    request: (): Promise<TopItemsResult> =>
      api
        .getTopItems(
          options.mediaType.value,
          options.period.value,
          TOP_ITEMS_LIMIT,
        )
        .then(
          (result) => ({ items: result, error: false }),
          () => ({ items: [], error: true }),
        ),
    apply: (result) => {
      items.value = result.items;
      error.value = result.error;
      return result.error;
    },
  });

  return { items, error, loading, refresh };
}
