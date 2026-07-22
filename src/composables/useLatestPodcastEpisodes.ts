/**
 * useLatestPodcastEpisodes
 *
 * Stateful orchestration for the "latest podcast episodes" page. It fetches
 * every podcast in the library, then fans out to each podcast's episode feed
 * with bounded concurrency, tolerating individual feed failures. The pure
 * merge/sort/cap logic lives in `@/helpers/podcast_latest`; the bounded
 * concurrency primitive lives in `@/helpers/concurrency`.
 */
import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { api } from "@/plugins/api";
import { $t } from "@/plugins/i18n";
import type { Podcast, PodcastEpisode } from "@/plugins/api/interfaces";
import { mapWithConcurrency } from "@/helpers/concurrency";
import {
  buildLatestEpisodes,
  DEFAULT_CANDIDATES_PER_PODCAST,
  MAX_LATEST_EPISODES,
} from "@/helpers/podcast_latest";

/** Maximum podcast feeds fetched in parallel. */
export const MAX_CONCURRENT_FEEDS = 4;

/** Page size used when paging through the library podcasts endpoint. */
const LIBRARY_PODCASTS_PAGE_SIZE = 500;

export interface UseLatestPodcastEpisodesOptions {
  candidatesPerPodcast?: number;
  maxResults?: number;
}

export interface LoadProgress {
  loaded: number;
  total: number;
}

export function useLatestPodcastEpisodes(
  options: UseLatestPodcastEpisodesOptions = {},
) {
  const candidatesPerPodcast =
    options.candidatesPerPodcast ?? DEFAULT_CANDIDATES_PER_PODCAST;
  const maxResults = options.maxResults ?? MAX_LATEST_EPISODES;

  const episodes = ref<PodcastEpisode[]>([]);
  const isLoading = ref(false);
  const hasLoadedOnce = ref(false);
  const loadFailed = ref(false);
  const failedFeedCount = ref(0);
  const loadedFeedCount = ref(0);
  const totalFeedCount = ref(0);

  const progress = computed<LoadProgress>(() => ({
    loaded: loadedFeedCount.value,
    total: totalFeedCount.value,
  }));

  // A single meaningful partial-failure state: some feeds failed but we still
  // produced a usable listing from the ones that succeeded.
  const hasPartialFailure = computed(
    () => !loadFailed.value && failedFeedCount.value > 0,
  );

  const loadAllLibraryPodcasts = async (): Promise<Podcast[]> => {
    const collected: Podcast[] = [];
    let offset = 0;
    // Page until a short page signals the end of the library.
    for (;;) {
      const page = await api.getLibraryPodcasts(
        undefined,
        undefined,
        LIBRARY_PODCASTS_PAGE_SIZE,
        offset,
      );
      collected.push(...page);
      if (page.length < LIBRARY_PODCASTS_PAGE_SIZE) break;
      offset += LIBRARY_PODCASTS_PAGE_SIZE;
    }
    return collected;
  };

  /**
   * Load (or reload) the latest episodes. Concurrent invocations are ignored so
   * a manual refresh cannot trigger overlapping loads.
   *
   * @param isManualRefresh when true, a success toast confirms the refresh.
   */
  const load = async (isManualRefresh = false): Promise<void> => {
    if (isLoading.value) return;
    isLoading.value = true;
    loadFailed.value = false;
    failedFeedCount.value = 0;
    loadedFeedCount.value = 0;
    totalFeedCount.value = 0;

    try {
      const podcasts = await loadAllLibraryPodcasts();
      totalFeedCount.value = podcasts.length;

      const settledFeeds = await mapWithConcurrency(
        podcasts,
        MAX_CONCURRENT_FEEDS,
        (podcast) => api.getPodcastEpisodes(podcast.item_id, podcast.provider),
        () => {
          loadedFeedCount.value += 1;
        },
      );

      const perPodcastEpisodeLists: PodcastEpisode[][] = [];
      let failures = 0;
      for (const feed of settledFeeds) {
        if (feed.status === "fulfilled") {
          perPodcastEpisodeLists.push(feed.value);
        } else {
          failures += 1;
        }
      }
      failedFeedCount.value = failures;

      // A non-empty library where every feed rejected is a hard load failure,
      // not a partial one: there is no usable listing to show. Empty libraries
      // and fulfilled-but-empty feeds stay normal empty content.
      if (podcasts.length > 0 && failures === podcasts.length) {
        loadFailed.value = true;
        episodes.value = [];
        hasLoadedOnce.value = true;
        toast.error($t("latest_episodes_load_failed"));
        return;
      }

      episodes.value = buildLatestEpisodes(perPodcastEpisodeLists, {
        candidatesPerPodcast,
        maxResults,
      });
      hasLoadedOnce.value = true;

      if (failures > 0) {
        toast.error($t("latest_episodes_partial_failure", [String(failures)]));
      } else if (isManualRefresh) {
        toast.success($t("latest_episodes_refreshed"));
      }
    } catch {
      loadFailed.value = true;
      episodes.value = [];
      hasLoadedOnce.value = true;
      toast.error($t("latest_episodes_load_failed"));
    } finally {
      isLoading.value = false;
    }
  };

  const refresh = (): Promise<void> => load(true);

  return {
    episodes,
    isLoading,
    hasLoadedOnce,
    loadFailed,
    failedFeedCount,
    totalFeedCount,
    progress,
    hasPartialFailure,
    load,
    refresh,
  };
}
