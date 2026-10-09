import { getImageThumbForItem } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import {
  ImageType,
  type ItemMapping,
  type Podcast,
  type PodcastEpisode,
} from "@/plugins/api/interfaces";

export interface PodcastEpisodeNumber {
  // as shown, e.g. "S1 E53", or "E53" without a season
  short: string;
  // as read out, e.g. "Season 1, episode 53"
  label: string;
}

export interface PodcastEpisodeBackdrop {
  // undefined when neither the episode nor its podcast has any artwork
  url?: string;
  // the cover standing in for missing wide art, which the hero blurs so it
  // reads as colour instead of a second copy of the cover beside it
  blurred: boolean;
}

/**
 * The artwork behind the episode hero: wide art (fanart, then landscape) of the
 * episode or the given podcast, else the cover to blur. No size is passed, so
 * the server serves the original image.
 */
export function podcastEpisodeBackdrop(
  episode: PodcastEpisode,
  podcast?: Podcast | ItemMapping,
): PodcastEpisodeBackdrop {
  const wide =
    getImageThumbForItem(episode, ImageType.FANART) ||
    getImageThumbForItem(episode, ImageType.LANDSCAPE) ||
    getImageThumbForItem(podcast, ImageType.FANART) ||
    getImageThumbForItem(podcast, ImageType.LANDSCAPE);
  if (wide) return { url: wide, blurred: false };
  return { url: getImageThumbForItem(episode, ImageType.THUMB), blurred: true };
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
