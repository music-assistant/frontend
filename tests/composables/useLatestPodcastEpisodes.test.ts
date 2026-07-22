import type { Podcast, PodcastEpisode } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetLibraryPodcasts, mockGetPodcastEpisodes, mockToast } =
  vi.hoisted(() => {
    return {
      mockGetLibraryPodcasts: vi.fn(),
      mockGetPodcastEpisodes: vi.fn(),
      mockToast: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
      },
    };
  });

vi.mock("@/plugins/api", () => ({
  api: {
    getLibraryPodcasts: mockGetLibraryPodcasts,
    getPodcastEpisodes: mockGetPodcastEpisodes,
  },
}));

vi.mock("vue-sonner", () => ({
  toast: mockToast,
}));

import { useLatestPodcastEpisodes } from "@/composables/useLatestPodcastEpisodes";

function makePodcast(id: string): Podcast {
  return { item_id: id, provider: "test" } as unknown as Podcast;
}

function makeEpisode(id: string, releaseDate?: string): PodcastEpisode {
  return {
    item_id: id,
    provider: "test",
    name: id,
    uri: `podcast_episode://test/${id}`,
    metadata: releaseDate ? { release_date: releaseDate } : {},
  } as unknown as PodcastEpisode;
}

describe("useLatestPodcastEpisodes", () => {
  beforeEach(() => {
    mockGetLibraryPodcasts.mockReset();
    mockGetPodcastEpisodes.mockReset();
    mockToast.success.mockReset();
    mockToast.error.mockReset();
  });

  it("sets a hard load failure when every feed rejects in a non-empty library", async () => {
    mockGetLibraryPodcasts.mockResolvedValueOnce([
      makePodcast("p1"),
      makePodcast("p2"),
    ]);
    mockGetLibraryPodcasts.mockResolvedValue([]);
    mockGetPodcastEpisodes.mockRejectedValue(new Error("boom"));

    const {
      episodes,
      loadFailed,
      hasPartialFailure,
      failedFeedCount,
      totalFeedCount,
      progress,
      load,
    } = useLatestPodcastEpisodes();

    await load();

    expect(loadFailed.value).toBe(true);
    expect(hasPartialFailure.value).toBe(false);
    expect(episodes.value).toEqual([]);
    expect(failedFeedCount.value).toBe(2);
    expect(totalFeedCount.value).toBe(2);
    expect(progress.value).toEqual({ loaded: 2, total: 2 });
    expect(mockToast.error).toHaveBeenCalledWith(
      $t("latest_episodes_load_failed"),
    );
    expect(mockToast.error).toHaveBeenCalledTimes(1);
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it("does not show refreshed feedback on an all-fail manual refresh", async () => {
    mockGetLibraryPodcasts.mockResolvedValueOnce([makePodcast("p1")]);
    mockGetLibraryPodcasts.mockResolvedValue([]);
    mockGetPodcastEpisodes.mockRejectedValue(new Error("boom"));

    const { loadFailed, refresh } = useLatestPodcastEpisodes();

    await refresh();

    expect(loadFailed.value).toBe(true);
    expect(mockToast.success).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalledWith(
      $t("latest_episodes_load_failed"),
    );
  });

  it("reports a partial failure when only some feeds reject", async () => {
    mockGetLibraryPodcasts.mockResolvedValueOnce([
      makePodcast("p1"),
      makePodcast("p2"),
    ]);
    mockGetLibraryPodcasts.mockResolvedValue([]);
    mockGetPodcastEpisodes.mockImplementation((itemId: string) =>
      itemId === "p1"
        ? Promise.resolve([makeEpisode("e1", "2024-01-01")])
        : Promise.reject(new Error("boom")),
    );

    const { episodes, loadFailed, hasPartialFailure, failedFeedCount, load } =
      useLatestPodcastEpisodes();

    await load();

    expect(loadFailed.value).toBe(false);
    expect(hasPartialFailure.value).toBe(true);
    expect(failedFeedCount.value).toBe(1);
    expect(episodes.value.map((e) => e.name)).toEqual(["e1"]);
    expect(mockToast.error).toHaveBeenCalledWith(
      $t("latest_episodes_partial_failure", ["1"]),
    );
  });

  it("stays normal empty content for an empty library", async () => {
    mockGetLibraryPodcasts.mockResolvedValue([]);

    const { episodes, loadFailed, hasPartialFailure, failedFeedCount, load } =
      useLatestPodcastEpisodes();

    await load();

    expect(loadFailed.value).toBe(false);
    expect(hasPartialFailure.value).toBe(false);
    expect(failedFeedCount.value).toBe(0);
    expect(episodes.value).toEqual([]);
    expect(mockGetPodcastEpisodes).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("succeeds with fulfilled-but-empty feeds", async () => {
    mockGetLibraryPodcasts.mockResolvedValueOnce([makePodcast("p1")]);
    mockGetLibraryPodcasts.mockResolvedValue([]);
    mockGetPodcastEpisodes.mockResolvedValue([]);

    const { episodes, loadFailed, hasPartialFailure, refresh } =
      useLatestPodcastEpisodes();

    await refresh();

    expect(loadFailed.value).toBe(false);
    expect(hasPartialFailure.value).toBe(false);
    expect(episodes.value).toEqual([]);
    expect(mockToast.error).not.toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalledWith(
      $t("latest_episodes_refreshed"),
    );
  });
});
