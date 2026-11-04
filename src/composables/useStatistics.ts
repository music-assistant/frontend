import {
  getPlaysOverTimeGranularity,
  groupLongHistoryByYear,
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
/** The number one artist card only needs the first artist. */
export const TOP_ARTISTS_LIMIT = 1;
/** Entries asked for from the distribution and listening time commands. */
export const DISTRIBUTION_LIMIT = 10;
/**
 * The server's cap on statistics results, so the genre shares and "other"
 * are taken from every genre rather than only the top ten.
 */
export const GENRE_DISTRIBUTION_LIMIT = 500;
/** Waits for a burst of finished tracks to settle before refreshing. */
export const PLAYLOG_REFRESH_DEBOUNCE_MS = 5000;
const LOAD_FAILED_TOAST_ID = "statistics-load-failed";

/** Everything the statistics views show for one period. */
export interface StatisticsData {
  playsOverTime: StatisticsTimeSeriesPoint[];
  topTracks: StatisticsTopItemResult[];
  topAlbums: StatisticsTopItemResult[];
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
    topItemsLimit: number,
    userIds: string[] | undefined,
  ) => Promise<StatisticsData[Section]>;
};

const REQUESTS: StatisticsRequests = {
  playsOverTime: async (period, _limit, userIds) =>
    groupLongHistoryByYear(
      await api.getPlaysOverTime(
        period,
        getPlaysOverTimeGranularity(period),
        userIds,
      ),
      period,
    ),
  topTracks: (period, limit, userIds) =>
    api.getTopItems(MediaType.TRACK, period, limit, userIds),
  topAlbums: (period, limit, userIds) =>
    api.getTopItems(MediaType.ALBUM, period, limit, userIds),
  // The number-one artist card always needs just one, regardless of the listing limit.
  topArtists: (period, _limit, userIds) =>
    api.getTopItems(MediaType.ARTIST, period, TOP_ARTISTS_LIMIT, userIds),
  listeningActivity: (period, _limit, userIds) =>
    api.getListeningActivity(period, userIds),
  listeningTime: (period, _limit, userIds) =>
    api.getListeningTime(period, "artist", DISTRIBUTION_LIMIT, userIds),
  genreDistribution: (period, _limit, userIds) =>
    api.getGenreDistribution(period, GENRE_DISTRIBUTION_LIMIT, userIds),
  decadeDistribution: (period, _limit, userIds) =>
    api.getDecadeDistribution(period, DISTRIBUTION_LIMIT, userIds),
};

// the commands default to the current user, so an empty selection sends none
const requestedUserIds = (
  userIds: Readonly<Ref<readonly string[]>> | undefined,
): string[] | undefined =>
  userIds?.value.length ? [...userIds.value] : undefined;

const emptyData = (): StatisticsData => ({
  playsOverTime: [],
  topTracks: [],
  topAlbums: [],
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
  // whose finished tracks refresh the data; empty is the current user
  userIds?: Readonly<Ref<readonly string[]>>;
  request: () => Promise<Result>;
  // stores a result and tells whether any part of it failed
  apply: (result: Result) => boolean;
}

/**
 * Loads statistics while `active` and connected, again when the key changes
 * and, debounced, when a shown user finishes a track. Only the latest
 * request is applied. `loading` is only set for the first load and for a
 * change of key; any other reload keeps the current data on screen until the
 * new data arrives. A failure toasts only when the user changed the key;
 * views show their own inline error for every failure.
 */
function useLatestLoad<Result>(options: LatestLoadOptions<Result>) {
  const loading = ref(false);
  let generation = 0;
  let disposed = false;
  let hasLoaded = false;
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
    if (userTriggered || !hasLoaded) loading.value = true;
    try {
      const result = await options.request();
      if (!isCurrent()) return;
      hasLoaded = true;
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
      const watched = requestedUserIds(options.userIds) ?? [
        store.currentUser?.user_id,
      ];
      if (update.userid && !watched.includes(update.userid)) return;
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
  // Album/track ranking size; defaults to TOP_ITEMS_LIMIT. Artists always use TOP_ARTISTS_LIMIT.
  topItemsLimit?: number;
  // the users whose plays are combined; empty or omitted is the current user
  userIds?: Readonly<Ref<readonly string[]>>;
}

/** The statistics of a period, each section requested in parallel. */
export function useStatistics(options: UseStatisticsOptions) {
  const data = shallowRef<StatisticsData>(emptyData());
  const failed = shallowRef<ReadonlySet<StatisticsSection>>(new Set());

  const { loading, refresh } = useLatestLoad({
    active: options.active,
    key: () => `${options.period.value}:${options.userIds?.value.join(",")}`,
    userIds: options.userIds,
    request: () =>
      Promise.allSettled(
        options.sections.map((section) =>
          REQUESTS[section](
            options.period.value,
            options.topItemsLimit ?? TOP_ITEMS_LIMIT,
            requestedUserIds(options.userIds),
          ),
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
  // the users whose plays are combined; empty or omitted is the current user
  userIds?: Readonly<Ref<readonly string[]>>;
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
    key: () =>
      `${options.period.value}:${options.mediaType.value}:${options.userIds?.value.join(",")}`,
    userIds: options.userIds,
    request: (): Promise<TopItemsResult> =>
      api
        .getTopItems(
          options.mediaType.value,
          options.period.value,
          TOP_ITEMS_LIMIT,
          requestedUserIds(options.userIds),
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
