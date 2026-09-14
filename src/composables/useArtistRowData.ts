import {
  appearsOnAlbums,
  isSingleOrEp,
  loadArtistLibraryTracks,
  loadArtistReleases,
  loadArtistTopTracks,
  loadSimilarArtists,
  sortReleasesNewestFirst,
} from "@/components/artist/artistData";
import { artistRows, type ArtistRowId } from "@/components/artist/artistRows";
import {
  rowSourceProvider,
  type RowSource,
} from "@/components/details/rowRegistry";
import { mappingsIdentity, useRowRequests } from "@/composables/useRowRequests";
import type {
  Album,
  Artist,
  ItemMapping,
  Track,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, ref, watch, type Ref } from "vue";

/**
 * What every row of the artist page shows, loaded as the visible rows need it.
 *
 * Each returned list is undefined while its row is still loading. Rows fed by
 * the same source share one request, a source the user switches to is requested
 * once and kept, and a response that arrives after the page moved on to another
 * artist is dropped.
 */
export function useArtistRowData(
  artist: Ref<Artist | undefined>,
  visibleRows: Ref<ArtistRowId[]>,
) {
  // Row data per source: two rows fed by the same source share one request and
  // a source change in the editor loads the new one. Absent = still loading.
  const releases = ref(new Map<RowSource, Album[]>());
  const topTracks = ref(new Map<RowSource, Track[]>());
  const similarArtists = ref(new Map<RowSource, Artist[]>());
  const libraryTracks = ref<Track[]>();

  // a new artist, or new provider mappings, start from empty rows; anything
  // else (a favorite toggle, a metadata update) keeps what is already loaded
  const { fetchOnce } = useRowRequests(artist, mappingsIdentity, () => {
    releases.value = new Map();
    topTracks.value = new Map();
    similarArtists.value = new Map();
    libraryTracks.value = undefined;
    loadRowData();
  });

  const rowSource = function (rowId: ArtistRowId): RowSource | undefined {
    if (!artist.value) return undefined;
    return artistRows.effectiveSource(rowId, artist.value);
  };

  const albumsSource = computed(() => rowSource("albums"));
  const singlesSource = computed(() => rowSource("singles_eps"));
  const appearsOnSource = computed(() => rowSource("appears_on"));
  const topTracksSource = computed(() => rowSource("top_tracks"));
  const similarArtistsSource = computed(() => rowSource("similar_artists"));

  // releases sorted newest first, from the source that feeds the given row
  const sortedReleases = function (source?: RowSource) {
    const items = sourceItems(releases.value, source);
    return items ? sortReleasesNewestFirst(items) : undefined;
  };

  const albumSourceReleases = computed(() =>
    sortedReleases(albumsSource.value),
  );
  const singlesSourceReleases = computed(() =>
    sortedReleases(singlesSource.value),
  );

  const albumItems = computed(() =>
    albumSourceReleases.value?.filter((album) => !isSingleOrEp(album)),
  );
  const singleItems = computed(() =>
    singlesSourceReleases.value?.filter((album) => isSingleOrEp(album)),
  );
  const latestRelease = computed(() => albumSourceReleases.value?.[0]);

  const albumsMeta = computed(() =>
    albumItems.value?.length
      ? `${albumItems.value.length} · ${$t("newest_first")}`
      : undefined,
  );

  // every album the artist's library tracks point at that is not one of their
  // own releases is an appearance
  const appearsOnItems = computed<Array<Album | ItemMapping> | undefined>(
    () => {
      const ownReleases = sourceItems(releases.value, appearsOnSource.value);
      if (!artist.value || !libraryTracks.value || !ownReleases)
        return undefined;
      return appearsOnAlbums(libraryTracks.value, artist.value, ownReleases);
    },
  );

  // falls back to the newest library tracks when no provider supplies top tracks
  const topTracksItems = computed(() => {
    const items = sourceItems(topTracks.value, topTracksSource.value);
    if (items === undefined) return undefined;
    if (items.length) return items;
    return libraryTracks.value && newestLibraryTracks(libraryTracks.value);
  });

  const similarArtistItems = computed(() =>
    sourceItems(similarArtists.value, similarArtistsSource.value),
  );

  const topTracksProvider = computed(() =>
    rowSourceProvider(topTracksSource.value),
  );
  const similarArtistsProvider = computed(() =>
    rowSourceProvider(similarArtistsSource.value),
  );

  // unhiding a row or switching its source in the editor loads what it needs,
  // without re-requesting what the visible rows already share
  watch(
    [
      visibleRows,
      albumsSource,
      singlesSource,
      appearsOnSource,
      topTracksSource,
      similarArtistsSource,
    ],
    () => loadRowData(),
  );

  /** Request what the visible rows need, skipping what is already on its way. */
  function loadRowData() {
    if (!artist.value) return;
    const rows = visibleRows.value;
    // the top tracks row shows the latest release from the albums source
    if (rows.includes("albums") || rows.includes("top_tracks")) {
      fetchReleases(albumsSource.value!);
    }
    if (rows.includes("singles_eps")) fetchReleases(singlesSource.value!);
    if (rows.includes("appears_on")) {
      fetchReleases(appearsOnSource.value!);
      fetchLibraryTracks();
    }
    if (rows.includes("top_tracks")) {
      fetchLibraryTracks();
      fetchTopTracks(topTracksSource.value!);
    }
    if (rows.includes("similar_artists")) {
      fetchSimilarArtists(similarArtistsSource.value!);
    }
  }

  function fetchReleases(source: RowSource) {
    return fetchInto("releases", source, releases.value, loadArtistReleases);
  }

  function fetchTopTracks(source: RowSource) {
    return fetchInto(
      "top_tracks",
      source,
      topTracks.value,
      loadArtistTopTracks,
    );
  }

  function fetchSimilarArtists(source: RowSource) {
    return fetchInto(
      "similar_artists",
      source,
      similarArtists.value,
      loadSimilarArtists,
    );
  }

  function fetchLibraryTracks() {
    return fetchOnce(
      "library_tracks",
      (artist) => loadArtistLibraryTracks(artist),
      (items) => (libraryTracks.value = items),
    );
  }

  /** One request per kind and source, kept for every row that shares it. */
  function fetchInto<T>(
    kind: string,
    source: RowSource,
    cache: Map<RowSource, T[]>,
    load: (artist: Artist, source: RowSource) => Promise<T[]>,
  ) {
    return fetchOnce(
      `${kind}:${source}`,
      (artist) => load(artist, source),
      (items) => cache.set(source, items),
    );
  }

  return {
    libraryTracks,
    topTracksItems,
    albumItems,
    singleItems,
    appearsOnItems,
    similarArtistItems,
    latestRelease,
    albumsMeta,
    topTracksProvider,
    similarArtistsProvider,
  };
}

/** The cached items of a source, undefined while unknown or still loading. */
function sourceItems<T>(
  cache: Map<RowSource, T[]>,
  source?: RowSource,
): T[] | undefined {
  return source ? cache.get(source) : undefined;
}

/** The library tracks of the newest releases first, the top-tracks fallback. */
function newestLibraryTracks(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => albumYear(b) - albumYear(a));
}

/** The release year of a track's album, 0 when it carries none. */
function albumYear(track: Track): number {
  return (track.album && "year" in track.album && track.album.year) || 0;
}
