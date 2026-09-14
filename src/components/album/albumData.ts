import { sortReleasesNewestFirst } from "@/components/artist/artistData";
import { getImageThumbForItem } from "@/helpers/utils";
import { api } from "@/plugins/api";
import {
  ImageType,
  type Album,
  type Artist,
  type Track,
} from "@/plugins/api/interfaces";

/** The album's tracks, limited to the ones in the library when asked for. */
export async function loadAlbumTracks(
  album: Album,
  inLibraryOnly = false,
): Promise<Track[]> {
  return await api.getAlbumTracks(album.item_id, album.provider, inLibraryOnly);
}

/** The same album elsewhere: other editions, and the copies other sources hold. */
export async function loadAlbumVersions(album: Album): Promise<Album[]> {
  return await api.getAlbumVersions(album.item_id, album.provider);
}

/**
 * The album artist's other releases, newest first.
 *
 * The album on screen is left out, by uri and by name: the artist's releases
 * are listed on whichever provider holds the artist, so the same album can come
 * back under an id this page has never seen.
 */
export async function loadArtistReleases(album: Album): Promise<Album[]> {
  const artist = album.artists[0];
  if (!artist) return [];
  const releases = await api.getArtistAlbums(artist.item_id, artist.provider);
  const name = album.name.toLowerCase();
  return sortReleasesNewestFirst(
    releases.filter(
      (release) =>
        release.uri !== album.uri && release.name.toLowerCase() !== name,
    ),
  );
}

/** The album's review, else the description it came with. */
export function albumReview(album: Album): string | undefined {
  return album.metadata?.review || album.metadata?.description || undefined;
}

/** The total playing time of the tracks, in seconds. */
export function albumDuration(tracks: Track[]): number {
  return tracks.reduce((total, track) => total + (track.duration || 0), 0);
}

export interface AlbumBackdrop {
  // undefined when neither the album nor its artist has any artwork
  url?: string;
  // the cover standing in for missing wide art, which the hero blurs so it
  // reads as colour instead of a second copy of the cover beside it
  blurred: boolean;
}

/**
 * The artwork behind the album hero: wide art (fanart, then landscape) of the
 * album or the given artist, else the cover to blur. No size is passed, so the
 * server serves the original image.
 */
export function albumBackdrop(album: Album, artist?: Artist): AlbumBackdrop {
  const wide =
    getImageThumbForItem(album, ImageType.FANART) ||
    getImageThumbForItem(album, ImageType.LANDSCAPE) ||
    getImageThumbForItem(artist, ImageType.FANART) ||
    getImageThumbForItem(artist, ImageType.LANDSCAPE);
  if (wide) return { url: wide, blurred: false };
  return { url: getImageThumbForItem(album, ImageType.THUMB), blurred: true };
}
