import {
  createRowRegistry,
  type RowDefinition,
} from "@/components/details/rowRegistry";
import type { Podcast } from "@/plugins/api/interfaces";

export type PodcastRowId = "about" | "episodes" | "provider_mappings";

// default order; no row has a source picker
export const PODCAST_ROWS: readonly RowDefinition<PodcastRowId>[] = [
  { id: "about", labelKey: "about_podcast" },
  { id: "episodes", labelKey: "podcast_episodes" },
  { id: "provider_mappings", labelKey: "source_details" },
];

export const PODCAST_ROWS_PREFERENCE_KEY = "podcast.rows";

/** The podcast page's rows and the user's customization of them. */
export const podcastRows = createRowRegistry<PodcastRowId, Podcast>({
  rows: PODCAST_ROWS,
  preferenceKey: PODCAST_ROWS_PREFERENCE_KEY,
});
