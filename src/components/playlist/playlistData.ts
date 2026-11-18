import { getImageThumbForItem } from "@/helpers/utils";
import {
  ImageType,
  type Audiobook,
  type Playlist,
  type PodcastEpisode,
  type Radio,
  type Track,
} from "@/plugins/api/interfaces";

// what a playlist can hold
export type PlaylistItem = Track | Radio | PodcastEpisode | Audiobook;

/** The total playing time of the items, in seconds; a radio station adds none. */
export function playlistDuration(items: PlaylistItem[]): number {
  return items.reduce(
    (total, item) => total + ("duration" in item ? item.duration || 0 : 0),
    0,
  );
}

export interface PlaylistBackdrop {
  // undefined when the playlist has no artwork at all
  url?: string;
  // the cover standing in for missing wide art, which the hero blurs so it
  // reads as colour instead of a second copy of the cover beside it
  blurred: boolean;
}

/**
 * The artwork behind the playlist hero: its wide art (fanart, then landscape),
 * else the cover to blur. No size is passed, so the server serves the original
 * image.
 */
export function playlistBackdrop(playlist: Playlist): PlaylistBackdrop {
  const wide =
    getImageThumbForItem(playlist, ImageType.FANART) ||
    getImageThumbForItem(playlist, ImageType.LANDSCAPE);
  if (wide) return { url: wide, blurred: false };
  return {
    url: getImageThumbForItem(playlist, ImageType.THUMB),
    blurred: true,
  };
}
