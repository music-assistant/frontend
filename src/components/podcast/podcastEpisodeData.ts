import { $t } from "@/plugins/i18n";
import { type PodcastEpisode } from "@/plugins/api/interfaces";

export interface PodcastEpisodeNumber {
  // as shown, e.g. "S1 E53", or "E53" without a season
  short: string;
  // as read out, e.g. "Season 1, episode 53"
  label: string;
}

/**
 * The publisher's season and episode number of an episode, or undefined when
 * the episode has no number of its own.
 */
export function podcastEpisodeNumber(
  episode: PodcastEpisode,
): PodcastEpisodeNumber | undefined {
  const number = episode.episode_number;
  if (number == null) return undefined;
  const season = episode.season;
  if (season == null) {
    return {
      short: $t("episode_number_short", [number]),
      label: $t("episode_number", [number]),
    };
  }
  return {
    short: $t("season_episode_number_short", [season, number]),
    label: $t("season_episode_number", [season, number]),
  };
}

/** The episode's publish date for display, empty when it has no valid one. */
export function episodeReleaseDate(episode: PodcastEpisode): string {
  const value = episode.metadata?.release_date;
  const released = value ? new Date(value) : undefined;
  return released && !isNaN(released.getTime())
    ? released.toLocaleDateString(undefined, { dateStyle: "medium" })
    : "";
}
