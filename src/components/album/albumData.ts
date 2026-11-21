import {
  artistAlbumsBySource,
  sortReleasesNewestFirst,
} from "@/components/artist/artistData";
import type { RowSource } from "@/components/details/rowRegistry";
import { api } from "@/plugins/api";
import {
  type Album,
  type SortDirection,
  type SortField,
  type Track,
} from "@/plugins/api/interfaces";

/** The album's tracks, limited to the ones in the library when asked for. */
export async function loadAlbumTracks(
  album: Album,
  inLibraryOnly = false,
  search?: string,
  limit?: number,
  offset?: number,
  sortField?: SortField,
  sortDirection?: SortDirection,
  favoriteOnly = false,
): Promise<Track[]> {
  return await api.getAlbumTracks(
    album.item_id,
    album.provider,
    inLibraryOnly,
    search,
    limit,
    offset,
    sortField,
    sortDirection,
    favoriteOnly || undefined,
  );
}

/** The same album elsewhere: other editions, and the copies other sources hold. */
export async function loadAlbumVersions(album: Album): Promise<Album[]> {
  return await api.getAlbumVersions(album.item_id, album.provider);
}

/**
 * The album artist's other releases from the given source, newest first.
 *
 * The album on screen is left out, by uri and by name: the artist's releases
 * are listed on whichever provider `source` selects, so the same album can come
 * back under an id this page has never seen.
 */
export async function loadArtistReleases(
  album: Album,
  source: RowSource,
): Promise<Album[]> {
  const artist = album.artists[0];
  if (!artist) return [];
  const releases = await artistAlbumsBySource(artist, source);
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
