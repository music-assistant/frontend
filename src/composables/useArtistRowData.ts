import {
  ARTIST_RELEASE_TYPES,
  artistAlbumsCountBySource,
  isSingleOrEp,
  loadArtistAppearsOn,
  loadArtistAppearsOnCount,
  loadArtistDiscography,
  loadArtistDiscographyCount,
  loadArtistReleases,
  loadArtistTopTracks,
  loadArtistTracks,
  loadArtistTracksCount,
  loadSimilarArtists,
} from "@/components/artist/artistData";
import { artistRows, type ArtistRowId } from "@/components/artist/artistRows";
import {
  discographyTypes,
  type DiscographyRowId,
} from "@/components/artist/discographyRows";
import {
  rowSourceDisplay,
  type RowSource,
} from "@/components/details/rowRegistry";
import { mappingsIdentity, useRowRequests } from "@/composables/useRowRequests";
import {
  MediaType,
  SortDirection,
  SortField,
  type Album,
  type Artist,
  type Track,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, ref, watch, type Ref } from "vue";

const ARTIST_SHELF_LIMIT = 50;

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
  const albumReleases = ref(new Map<RowSource, Album[]>());
  const singlesReleases = ref(new Map<RowSource, Album[]>());
  const albumCounts = ref(new Map<RowSource, number | undefined>());
  const singlesCounts = ref(new Map<RowSource, number | undefined>());
  const topTracks = ref(new Map<RowSource, Track[]>());
  const similarArtists = ref(new Map<RowSource, Artist[]>());
  const artistTracks = ref<Track[]>();
  const artistTracksCount = ref<number>();
  // fed by the artist alone, so these need no per-source cache
  const appearsOn = ref<Album[]>();
  const appearsOnCount = ref<number>();
  // the discography per selection of release types, e.g. "album,live"
  const discography = ref(new Map<string, Album[]>());
  const discographyCounts = ref(new Map<string, number | undefined>());

  // a new artist, or new provider mappings, start from empty rows; anything
  // else (a favorite toggle, a metadata update) keeps what is already loaded
  const { fetchOnce, fetchOnceValue, refetchOnLibraryChange } = useRowRequests(
    artist,
    mappingsIdentity,
    () => {
      albumReleases.value = new Map();
      singlesReleases.value = new Map();
      albumCounts.value = new Map();
      singlesCounts.value = new Map();
      topTracks.value = new Map();
      similarArtists.value = new Map();
      artistTracks.value = undefined;
      artistTracksCount.value = undefined;
      appearsOn.value = undefined;
      appearsOnCount.value = undefined;
      discography.value = new Map();
      discographyCounts.value = new Map();
      loadRowData();
    },
  );

  refetchOnLibraryChange(
    {
      [MediaType.ALBUM]: [
        "releases",
        "release_count:",
        "appears_on",
        "appears_on_count",
        "discography",
        "discography_count",
      ],
      [MediaType.TRACK]: [
        "artist_tracks",
        "artist_tracks_count",
        "appears_on",
        "appears_on_count",
        "top_tracks",
      ],
    },
    () => loadRowData(),
  );

  const rowSource = function (rowId: ArtistRowId): RowSource | undefined {
    if (!artist.value) return undefined;
    return artistRows.effectiveSource(rowId, artist.value);
  };

  const albumsSource = computed(() => rowSource("albums"));
  const singlesSource = computed(() => rowSource("singles_eps"));
  const topTracksSource = computed(() => rowSource("top_tracks"));
  const similarArtistsSource = computed(() => rowSource("similar_artists"));
  const discographyKey = computed(() => typesKey("discography"));
  const discographySecondKey = computed(() => typesKey("discography_second"));

  const albumSourceReleases = computed(() =>
    sourceItems(albumReleases.value, albumsSource.value),
  );
  const singlesSourceReleases = computed(() =>
    sourceItems(singlesReleases.value, singlesSource.value),
  );

  const albumItems = computed(() =>
    albumSourceReleases.value?.filter((album) => !isSingleOrEp(album)),
  );
  const singleItems = computed(() =>
    singlesSourceReleases.value?.filter(isSingleOrEp),
  );
  const albumsCount = computed(() =>
    albumsSource.value ? albumCounts.value.get(albumsSource.value) : undefined,
  );

  const albumsMeta = computed(() =>
    albumsCount.value
      ? `${albumsCount.value} · ${$t("newest_first")}`
      : undefined,
  );

  const singlesCount = computed(() =>
    singlesSource.value
      ? singlesCounts.value.get(singlesSource.value)
      : undefined,
  );

  const appearsOnItems = computed(() => appearsOn.value);

  // kept in the order the server sent it, which is newest first
  const discographyItems = computed(() =>
    discography.value.get(discographyKey.value),
  );
  const discographySecondItems = computed(() =>
    discography.value.get(discographySecondKey.value),
  );
  const discographyCount = computed(() =>
    discographyCounts.value.get(discographyKey.value),
  );
  const discographySecondCount = computed(() =>
    discographyCounts.value.get(discographySecondKey.value),
  );

  // falls back to the artist's newest tracks when no provider supplies top
  // tracks (for a provider artist, those of its own provider)
  const topTracksItems = computed(() => {
    const items = sourceItems(topTracks.value, topTracksSource.value);
    if (items === undefined) return undefined;
    if (items.length) return items;
    return artistTracks.value && newestArtistTracks(artistTracks.value);
  });

  const similarArtistItems = computed(() =>
    sourceItems(similarArtists.value, similarArtistsSource.value),
  );

  const albumsSourceDisplay = computed(() =>
    rowSourceDisplay(albumsSource.value),
  );
  const singlesSourceDisplay = computed(() =>
    rowSourceDisplay(singlesSource.value),
  );

  // on that fallback, only a library artist's badge switches to the library
  const topTracksSourceDisplay = computed(() => {
    const provided = sourceItems(topTracks.value, topTracksSource.value);
    const usesLibraryFallback =
      artist.value?.provider === "library" &&
      provided?.length === 0 &&
      !!artistTracks.value?.length;
    return rowSourceDisplay(
      usesLibraryFallback ? "library" : topTracksSource.value,
    );
  });

  const similarArtistsSourceDisplay = computed(() =>
    rowSourceDisplay(similarArtistsSource.value),
  );

  // unhiding a row, switching its source in the editor or changing a
  // discography row's types loads what it needs, without re-requesting what
  // the visible rows already share
  watch(
    [
      visibleRows,
      albumsSource,
      singlesSource,
      topTracksSource,
      similarArtistsSource,
      discographyKey,
      discographySecondKey,
    ],
    () => loadRowData(),
  );

  watch(
    [
      visibleRows,
      topTracksSource,
      () => sourceItems(topTracks.value, topTracksSource.value),
    ],
    ([rows, , tracks]) => {
      if (rows.includes("top_tracks") && tracks?.length === 0) {
        fetchArtistTracks();
      }
    },
  );

  /** Request what the visible rows need, skipping what is already on its way. */
  function loadRowData() {
    if (!artist.value) return;
    const rows = visibleRows.value;
    if (rows.includes("albums")) {
      fetchReleases("albums", albumsSource.value!);
      fetchReleaseCount("albums", albumsSource.value!);
    }
    if (rows.includes("singles_eps")) {
      fetchReleases("singles_eps", singlesSource.value!);
      fetchReleaseCount("singles_eps", singlesSource.value!);
    }
    if (rows.includes("appears_on")) {
      fetchAppearsOn();
      fetchAppearsOnCount();
    }
    if (rows.includes("discography")) {
      fetchDiscography("discography");
      fetchDiscographyCount("discography");
    }
    if (rows.includes("discography_second")) {
      fetchDiscography("discography_second");
      fetchDiscographyCount("discography_second");
    }
    if (rows.includes("top_tracks")) {
      fetchArtistTracksCount();
      fetchTopTracks(topTracksSource.value!);
    }
    if (rows.includes("similar_artists")) {
      fetchSimilarArtists(similarArtistsSource.value!);
    }
  }

  function fetchReleases(rowId: "albums" | "singles_eps", source: RowSource) {
    const cache =
      rowId === "albums" ? albumReleases.value : singlesReleases.value;
    return fetchInto(
      `releases:${rowId}`,
      source,
      cache,
      (requestedArtist, rowSource) =>
        loadArtistReleases(requestedArtist, rowSource, {
          limit: ARTIST_SHELF_LIMIT,
          sortField: SortField.RELEASE_DATE,
          sortDirection: SortDirection.DESC,
          albumTypes: ARTIST_RELEASE_TYPES[rowId],
        }),
    );
  }

  function fetchReleaseCount(
    rowId: "albums" | "singles_eps",
    source: RowSource,
  ) {
    const counts = rowId === "albums" ? albumCounts.value : singlesCounts.value;
    return fetchOnceValue(
      `release_count:${rowId}:${source}`,
      (artist) =>
        artistAlbumsCountBySource(artist, source, ARTIST_RELEASE_TYPES[rowId]),
      (count) => counts.set(source, count),
      undefined,
    );
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

  function fetchAppearsOn() {
    return fetchOnce(
      "appears_on",
      (artist) => loadArtistAppearsOn(artist, undefined, ARTIST_SHELF_LIMIT),
      (items) => (appearsOn.value = items),
    );
  }

  /** One request per selection of types, shared by rows showing the same. */
  function fetchDiscography(rowId: DiscographyRowId) {
    const types = discographyTypes(rowId);
    const key = types.join(",");
    return fetchOnce(
      `discography:${key}`,
      (artist) =>
        loadArtistDiscography(artist, types, undefined, ARTIST_SHELF_LIMIT),
      (items) => discography.value.set(key, items),
    );
  }

  function fetchAppearsOnCount() {
    return fetchOnceValue(
      "appears_on_count",
      loadArtistAppearsOnCount,
      (count) => (appearsOnCount.value = count),
      undefined,
    );
  }

  function fetchDiscographyCount(rowId: DiscographyRowId) {
    const types = discographyTypes(rowId);
    const key = types.join(",");
    return fetchOnceValue(
      `discography_count:${key}`,
      (artist) => loadArtistDiscographyCount(artist, types),
      (count) => discographyCounts.value.set(key, count),
      undefined,
    );
  }

  function fetchArtistTracksCount() {
    return fetchOnceValue(
      "artist_tracks_count",
      loadArtistTracksCount,
      (count) => (artistTracksCount.value = count),
      undefined,
    );
  }

  function fetchArtistTracks() {
    return fetchOnce(
      "artist_tracks",
      (artist) => loadArtistTracks(artist),
      (items) => (artistTracks.value = items),
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
    artistTracks,
    artistTracksCount,
    topTracksItems,
    albumItems,
    singleItems,
    albumsCount,
    singlesCount,
    appearsOnItems,
    appearsOnCount,
    discographyItems,
    discographyCount,
    discographySecondItems,
    discographySecondCount,
    similarArtistItems,
    albumsMeta,
    albumsSource,
    singlesSource,
    topTracksSource,
    similarArtistsSource,
    albumsSourceDisplay,
    singlesSourceDisplay,
    topTracksSourceDisplay,
    similarArtistsSourceDisplay,
  };
}

/** A discography row's types as its cache key, e.g. "album,live". */
function typesKey(rowId: DiscographyRowId): string {
  return discographyTypes(rowId).join(",");
}

/** The cached items of a source, undefined while unknown or still loading. */
function sourceItems<T>(
  cache: Map<RowSource, T[]>,
  source?: RowSource,
): T[] | undefined {
  return source ? cache.get(source) : undefined;
}

/** The artist's tracks, newest release first, as the top-tracks fallback. */
function newestArtistTracks(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => albumYear(b) - albumYear(a));
}

/** The release year of a track's album, 0 when it carries none. */
function albumYear(track: Track): number {
  return (track.album && "year" in track.album && track.album.year) || 0;
}
