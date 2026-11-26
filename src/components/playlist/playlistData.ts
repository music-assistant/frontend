import {
  type Audiobook,
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
