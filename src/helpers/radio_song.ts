import {
  MediaType,
  type MediaItemType,
  type PlayerMedia,
} from "@/plugins/api/interfaces";

/** The song a radio station reports it is playing. */
export interface RadioSong {
  artist: string;
  title: string;
}

/**
 * The song a radio station is playing, when the station names it.
 *
 * :param mediaItem: The media item of the queue item that plays.
 * :param currentMedia: What the player reports it is playing.
 * :return: The song, or undefined when no station plays or it names no song
 *   (talk, ads, a station without song info).
 */
export function radioSong(
  mediaItem: MediaItemType | null | undefined,
  currentMedia: PlayerMedia | null | undefined,
): RadioSong | undefined {
  if (mediaItem?.media_type !== MediaType.RADIO) return undefined;
  const artist = currentMedia?.artist;
  const title = currentMedia?.title;
  return artist && title ? { artist, title } : undefined;
}

/**
 * The song as one line of text, artist first.
 *
 * :param song: The song to show.
 */
export function radioSongLabel(song: RadioSong): string {
  return `${song.artist} – ${song.title}`;
}
