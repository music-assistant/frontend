import { getImageThumbForItem } from "@/helpers/utils";
import { ImageType, type Podcast } from "@/plugins/api/interfaces";

export interface PodcastBackdrop {
  // undefined when the podcast has no artwork
  url?: string;
  // the cover standing in for missing wide art, which the hero blurs so it
  // reads as colour instead of a second copy of the cover beside it
  blurred: boolean;
}

/**
 * The artwork behind the podcast hero: its wide art (fanart, then landscape),
 * else the cover to blur. No size is passed, so the server serves the original
 * image.
 */
export function podcastBackdrop(podcast: Podcast): PodcastBackdrop {
  const wide =
    getImageThumbForItem(podcast, ImageType.FANART) ||
    getImageThumbForItem(podcast, ImageType.LANDSCAPE);
  if (wide) return { url: wide, blurred: false };
  return { url: getImageThumbForItem(podcast, ImageType.THUMB), blurred: true };
}
