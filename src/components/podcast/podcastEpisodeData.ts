import { getImageThumbForItem } from "@/helpers/utils";
import {
  ImageType,
  type ItemMapping,
  type Podcast,
  type PodcastEpisode,
} from "@/plugins/api/interfaces";

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
