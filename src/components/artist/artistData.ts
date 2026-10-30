import {
  rowSourceLabel,
  type RowSource,
} from "@/components/details/rowRegistry";
import { api } from "@/plugins/api";
import {
  AlbumType,
  ProviderFeature,
  type Album,
  type Artist,
  type ItemMapping,
  type SortDirection,
  type SortField,
  type Track,
} from "@/plugins/api/interfaces";

export const ARTIST_RELEASE_TYPES: Record<
  "albums" | "singles_eps",
  AlbumType[]
> = {
  albums: [
    AlbumType.ALBUM,
    AlbumType.COMPILATION,
    AlbumType.LIVE,
    AlbumType.SOUNDTRACK,
    AlbumType.UNKNOWN,
  ],
  singles_eps: [AlbumType.SINGLE, AlbumType.EP],
};

/**
 * The artist's releases, from the library or from a single provider's own
 * catalog. See artistAlbumsBySource for how `source` selects the provider.
 */
export async function loadArtistReleases(
  artist: Artist,
  source: RowSource,
  options?: ArtistAlbumsListingOptions,
): Promise<Album[]> {
  return await artistAlbumsBySource(artist, source, options);
}

interface ArtistAlbumsListingOptions {
  search?: string;
  limit?: number;
  offset?: number;
  sortField?: SortField;
  sortDirection?: SortDirection;
  albumTypes?: AlbumType[];
  favoritesOnly?: boolean;
}

/**
 * The releases of an artist from one source: the library, or a single
 * provider's own catalog.
 *
 * `source` follows a row registry's effectiveSource: "library" returns the
 * in-library albums, a provider instance id queries that provider with the
 * artist's id there, so an artist not mapped to it has no releases to show. A
 * provider (non-library) artist always comes from its own provider. A slim
 * mapping carries no provider mappings, so a provider source yields nothing.
 */
export async function artistAlbumsBySource(
  artist: ItemMapping | Artist,
  source: RowSource,
  options?: ArtistAlbumsListingOptions,
): Promise<Album[]> {
  const target = artistListingSource(artist, source);
  if (!target) return [];
  const getAlbums = (itemId: string, provider: string) =>
    options
      ? api.getArtistAlbums(
          itemId,
          provider,
          undefined,
          options.search,
          options.limit,
          options.offset,
          options.sortField,
          options.sortDirection,
          options.albumTypes,
          options.favoritesOnly || undefined,
        )
      : api.getArtistAlbums(itemId, provider, undefined, undefined, 0);
  return await getAlbums(target.itemId, target.provider);
}

export async function artistAlbumsCountBySource(
  artist: Artist,
  source: RowSource,
  albumTypes: AlbumType[],
): Promise<number> {
  const target = artistListingSource(artist, source);
  if (!target) return 0;
  return await api.getArtistAlbumsCount(
    target.itemId,
    target.provider,
    undefined,
    undefined,
    albumTypes,
  );
}

/**
 * The artist's discography as MusicBrainz knows it, newest first: the library
 * albums, and the releases outside the library as MusicBrainz items. All of
 * them, or one page when a limit is given.
 *
 * Only ever called for a library artist, the only kind the server lists.
 */
export async function loadArtistDiscography(
  artist: Artist,
  search?: string,
  limit?: number,
  offset?: number,
  sortField?: SortField,
  sortDirection?: SortDirection,
): Promise<Album[]> {
  return await api.getArtistDiscography(
    artist.item_id,
    search,
    limit ?? 0,
    offset,
    sortField,
    sortDirection,
  );
}

export async function loadArtistDiscographyCount(
  artist: Artist,
): Promise<number> {
  if (artist.provider !== "library") return 0;
  return await api.getArtistDiscographyCount(artist.item_id);
}

/**
 * The provider instances the artist is mapped to that support `feature`, sorted
 * by their source label: the candidate sources for a row fed by the artist's
 * own provider catalogs. A streaming service is offered once, as the instance
 * with the lowest id, since all of its accounts share one catalog.
 */
export function artistProvidersForFeature(
  artist: Artist,
  feature: ProviderFeature,
): string[] {
  // keyed by domain for a streaming provider, by instance id for any other
  const ids = new Map<string, string>();
  for (const mapping of artist.provider_mappings) {
    const provider = api.providers[mapping.provider_instance];
    if (!provider?.supported_features.includes(feature)) continue;
    const key = provider.is_streaming_provider
      ? provider.domain
      : provider.instance_id;
    const current = ids.get(key);
    if (!current || provider.instance_id < current) {
      ids.set(key, provider.instance_id);
    }
  }
  return [...ids.values()].sort((a, b) =>
    rowSourceLabel(a).localeCompare(rowSourceLabel(b)),
  );
}

function artistListingSource(
  artist: ItemMapping | Artist,
  source: RowSource,
): { itemId: string; provider: string } | undefined {
  if (source === "library" || artist.provider !== "library") {
    return { itemId: artist.item_id, provider: artist.provider };
  }
  const mappings =
    "provider_mappings" in artist ? artist.provider_mappings : [];
  const mapping = mappings.find(
    (candidate) => candidate.provider_instance === source,
  );
  return mapping
    ? { itemId: mapping.item_id, provider: mapping.provider_instance }
    : undefined;
}

/**
 * The artist's tracks, optionally limited to a single provider: those in the
 * library for a library artist, its provider's own for a provider artist.
 * All of them, or one page when a limit is given.
 */
export async function loadArtistTracks(
  artist: Artist,
  providerFilter?: string,
  search?: string,
  limit?: number,
  offset?: number,
  sortField?: SortField,
  sortDirection?: SortDirection,
  favoriteOnly = false,
): Promise<Track[]> {
  return await api.getArtistTracks(
    artist.item_id,
    artist.provider,
    providerFilter,
    search,
    limit ?? 0,
    offset,
    sortField,
    sortDirection,
    favoriteOnly || undefined,
  );
}

export async function loadArtistTracksCount(artist: Artist): Promise<number> {
  return await api.getArtistTracksCount(artist.item_id, artist.provider);
}

/**
 * Albums the artist appears on without being an album artist, newest first.
 * All of them, or one page when a limit is given.
 *
 * Only ever called for a library artist, the only kind the server lists.
 */
export async function loadArtistAppearsOn(
  artist: Artist,
  search?: string,
  limit?: number,
  offset?: number,
  sortField?: SortField,
  sortDirection?: SortDirection,
): Promise<Album[]> {
  return await api.getArtistAppearsOn(
    artist.item_id,
    artist.provider,
    undefined,
    search,
    limit ?? 0,
    offset,
    sortField,
    sortDirection,
  );
}

export async function loadArtistAppearsOnCount(
  artist: Artist,
): Promise<number> {
  if (artist.provider !== "library") return 0;
  return await api.getArtistAppearsOnCount(artist.item_id, artist.provider);
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
    25,
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
