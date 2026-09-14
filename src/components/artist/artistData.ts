import type { RowSource } from "@/components/details/rowRegistry";
import { api } from "@/plugins/api";
import {
  AlbumType,
  type Album,
  type Artist,
  type ItemMapping,
  type Track,
} from "@/plugins/api/interfaces";

/**
 * The artist's releases, from the library or from a single provider's own
 * catalog.
 *
 * `source` follows artistRows.effectiveSource: "library" returns the in-library
 * albums, a provider instance id queries that provider with the artist's id
 * there, so an artist not mapped to it has no releases to show. A provider
 * (non-library) artist always comes from its own provider.
 */
export async function loadArtistReleases(
  artist: Artist,
  source: RowSource,
): Promise<Album[]> {
  if (source === "library" || artist.provider !== "library") {
    return await api.getArtistAlbums(artist.item_id, artist.provider);
  }
  const mapping = artist.provider_mappings.find(
    (candidate) => candidate.provider_instance === source,
  );
  if (!mapping) return [];
  return await api.getArtistAlbums(mapping.item_id, mapping.provider_instance);
}

/** The artist's in-library tracks, optionally limited to a single provider. */
export async function loadArtistLibraryTracks(
  artist: Artist,
  providerFilter?: string,
): Promise<Track[]> {
  return await api.getArtistTracks(
    artist.item_id,
    artist.provider,
    providerFilter,
  );
}

/** The artist's most popular tracks, as reported by `source`. */
export async function loadArtistTopTracks(
  artist: Artist,
  source: RowSource,
): Promise<Track[]> {
  return await api.getArtistTopTracks(
    artist.item_id,
    artist.provider,
    aggregatedProviderFilter(artist, source),
  );
}

/** Artists similar to this one, as reported by `source`. */
export async function loadSimilarArtists(
  artist: Artist,
  source: RowSource,
): Promise<Artist[]> {
  return await api.getSimilarArtists(
    artist.item_id,
    artist.provider,
    aggregatedProviderFilter(artist, source),
  );
}

/** Whether the release belongs in the "Singles & EPs" shelf instead of "Albums". */
export function isSingleOrEp(album: Album | ItemMapping): boolean {
  if (!("album_type" in album)) return false;
  return (
    album.album_type === AlbumType.SINGLE || album.album_type === AlbumType.EP
  );
}

/**
 * The releases sorted newest first by release date, falling back to the
 * release year and then the name.
 */
export function sortReleasesNewestFirst<T extends Album>(albums: T[]): T[] {
  return [...albums].sort((a, b) => {
    const released = releaseTime(b) - releaseTime(a);
    return released !== 0 ? released : a.name.localeCompare(b.name);
  });
}

/**
 * Albums the artist appears on without being an album artist, derived from the
 * artist's library tracks.
 *
 * A library track carries its album as a slim mapping without album artists,
 * so pass the artist's own releases as `artistAlbums` to leave those out.
 */
export function appearsOnAlbums(
  tracks: Track[],
  artist: Artist,
  artistAlbums: Array<Album | ItemMapping> = [],
): Array<Album | ItemMapping> {
  const ownAlbums = new Set(artistAlbums.map((album) => album.uri));
  const albums = new Map<string, Album | ItemMapping>();
  for (const track of tracks) {
    const album = track.album;
    if (!album || ownAlbums.has(album.uri) || albums.has(album.uri)) continue;
    if (isAlbumArtist(album, artist)) continue;
    albums.set(album.uri, album);
  }
  return [...albums.values()];
}

/** The provider_filter argument for a source, or undefined for "library"/"all". */
function providerFilterFor(source: RowSource): string | undefined {
  return source === "library" || source === "all" ? undefined : source;
}

/**
 * The provider_filter for the server-aggregated listings (top tracks, similar
 * artists): only a library artist aggregates providers, a provider artist is
 * always queried on its own provider.
 */
function aggregatedProviderFilter(
  artist: Artist,
  source: RowSource,
): string | undefined {
  return artist.provider === "library" ? providerFilterFor(source) : undefined;
}

/** Sortable release timestamp: the release date, else the release year. */
function releaseTime(album: Album): number {
  const releaseDate = album.metadata?.release_date;
  if (releaseDate) {
    const parsed = Date.parse(releaseDate);
    if (!isNaN(parsed)) return parsed;
  }
  return album.year ? Date.UTC(album.year, 0, 1) : 0;
}

/** Whether the artist is credited as an album artist of the given album. */
function isAlbumArtist(album: Album | ItemMapping, artist: Artist): boolean {
  if (!("artists" in album)) return false;
  return album.artists.some(
    (albumArtist) =>
      albumArtist.uri === artist.uri ||
      albumArtist.name.toLowerCase() === artist.name.toLowerCase(),
  );
}
