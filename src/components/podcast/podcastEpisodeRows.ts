import {
  createRowRegistry,
  type RowDefinition,
} from "@/components/details/rowRegistry";
import type { PodcastEpisode } from "@/plugins/api/interfaces";

export type PodcastEpisodeRowId = "about" | "chapters" | "episodes";

// default order; no row has a source picker
export const PODCAST_EPISODE_ROWS: readonly RowDefinition<PodcastEpisodeRowId>[] =
  [
    { id: "about", labelKey: "about_episode" },
    { id: "chapters", labelKey: "chapters" },
    { id: "episodes", labelKey: "other_episodes" },
  ];

export const PODCAST_EPISODE_ROWS_PREFERENCE_KEY = "podcast_episode.rows";

/** The podcast episode page's rows and the user's customization of them. */
export const podcastEpisodeRows = createRowRegistry<
  PodcastEpisodeRowId,
  PodcastEpisode
>({
  rows: PODCAST_EPISODE_ROWS,
  preferenceKey: PODCAST_EPISODE_ROWS_PREFERENCE_KEY,
});
