import {
  appearsOnAlbums,
  isInLibrary,
  isSingleOrEp,
  loadArtistLibraryTracks,
  loadArtistReleases,
  loadArtistTopTracks,
  loadSimilarArtists,
  sortReleasesNewestFirst,
} from "@/components/artist/artistData";
import {
  effectiveArtistRowSource,
  type ArtistRowId,
  type ArtistRowSource,
} from "@/components/artist/artistRows";
import { api } from "@/plugins/api";
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
  isAudiobookArtist: Ref<boolean>,
) {
  // Row data per source: two rows fed by the same source share one request and
  // a source change in the editor loads the new one. Absent = still loading.
  const releases = ref(new Map<ArtistRowSource, Album[]>());
  const topTracks = ref(new Map<ArtistRowSource, Track[]>());
  const similarArtists = ref(new Map<ArtistRowSource, Artist[]>());
  const libraryTracks = ref<Track[]>();

  // the requests already sent for the artist currently shown, as "<kind>:<source>"
  let requested = new Set<string>();

  const rowSource = function (rowId: ArtistRowId): ArtistRowSource | undefined {
    if (!artist.value) return undefined;
    return effectiveArtistRowSource(
      rowId,
      artist.value,
      api.supportsArtistDiscography,
    );
  };

  const albumsSource = computed(() => rowSource("albums"));
  const singlesSource = computed(() => rowSource("singles_eps"));
  const appearsOnSource = computed(() => rowSource("appears_on"));
  const topTracksSource = computed(() => rowSource("top_tracks"));
  const similarArtistsSource = computed(() => rowSource("similar_artists"));

  // releases sorted newest first, from the source that feeds the given row
  const sortedReleases = function (source?: ArtistRowSource) {
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

  // the full discography is the only list that knows how much of it is missing
  const releaseCounts = computed(() => {
    const all = releases.value.get("all");
    if (!all?.length) return undefined;
    return {
      inLibrary: all.filter((album) => isInLibrary(album)).length,
      total: all.length,
    };
  });

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
    sourceProvider(topTracksSource.value),
  );
  const similarArtistsProvider = computed(() =>
    sourceProvider(similarArtistsSource.value),
  );

  // a new artist starts from empty rows; anything else (a favorite toggle, a
  // metadata update) keeps what is already loaded
  watch(
    () => artist.value?.uri,
    () => {
      releases.value = new Map();
      topTracks.value = new Map();
      similarArtists.value = new Map();
      libraryTracks.value = undefined;
      requested = new Set();
      loadRowData();
    },
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

  /** Reloads every release list on screen, so a library change made from a shelf shows everywhere. */
  function refreshReleases() {
    const shown = artist.value;
    if (!shown) return;
    for (const source of releases.value.keys()) {
      requested.delete(`releases:${source}`);
      fetchReleases(shown, source);
    }
    // the track count and the appearances are derived from the library tracks
    if (libraryTracks.value) {
      requested.delete("library_tracks");
      fetchLibraryTracks(shown);
    }
  }

  /** Request what the visible rows need, skipping what is already on its way. */
  function loadRowData() {
    const shown = artist.value;
    if (!shown) return;
    const rows = visibleRows.value;
    // the hero's release chip needs the complete discography
    if (
      shown.provider === "library" &&
      !isAudiobookArtist.value &&
      api.supportsArtistDiscography
    ) {
      fetchReleases(shown, "all");
    }
    if (rows.includes("albums")) fetchReleases(shown, albumsSource.value!);
    if (rows.includes("singles_eps"))
      fetchReleases(shown, singlesSource.value!);
    if (rows.includes("appears_on")) {
      fetchReleases(shown, appearsOnSource.value!);
      fetchLibraryTracks(shown);
    }
    if (rows.includes("top_tracks")) {
      fetchLibraryTracks(shown);
      fetchTopTracks(shown, topTracksSource.value!);
    }
    if (rows.includes("similar_artists")) {
      fetchSimilarArtists(shown, similarArtistsSource.value!);
    }
  }

  function fetchReleases(artist: Artist, source: ArtistRowSource) {
    return fetchInto(
      artist,
      "releases",
      source,
      releases.value,
      loadArtistReleases,
    );
  }

  function fetchTopTracks(artist: Artist, source: ArtistRowSource) {
    return fetchInto(
      artist,
      "top_tracks",
      source,
      topTracks.value,
      loadArtistTopTracks,
    );
  }

  function fetchSimilarArtists(artist: Artist, source: ArtistRowSource) {
    return fetchInto(
      artist,
      "similar_artists",
      source,
      similarArtists.value,
      loadSimilarArtists,
    );
  }

  async function fetchLibraryTracks(artist: Artist) {
    if (requested.has("library_tracks")) return;
    requested.add("library_tracks");
    const items = await orEmpty(loadArtistLibraryTracks(artist));
    if (stillShown(artist.uri)) libraryTracks.value = items;
  }

  /** One request per kind and source, kept for every row that shares it. */
  async function fetchInto<T>(
    artist: Artist,
    kind: string,
    source: ArtistRowSource,
    cache: Map<ArtistRowSource, T[]>,
    load: (artist: Artist, source: ArtistRowSource) => Promise<T[]>,
  ) {
    const key = `${kind}:${source}`;
    if (requested.has(key)) return;
    requested.add(key);
    const items = await orEmpty(load(artist, source));
    if (stillShown(artist.uri)) cache.set(source, items);
  }

  /** Whether a finished request still belongs to the artist on screen. */
  function stillShown(uri: string): boolean {
    return artist.value?.uri === uri;
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
    releaseCounts,
    topTracksProvider,
    similarArtistsProvider,
    refreshReleases,
  };
}

/** The cached items of a source, undefined while unknown or still loading. */
function sourceItems<T>(
  cache: Map<ArtistRowSource, T[]>,
  source?: ArtistRowSource,
): T[] | undefined {
  return source ? cache.get(source) : undefined;
}

/** The provider behind a row's source, when a single one feeds it. */
function sourceProvider(source?: ArtistRowSource) {
  if (!source || source === "all" || source === "library") return undefined;
  const provider = api.getProvider(source);
  return provider && { name: provider.name, domain: provider.domain };
}

/** The library tracks of the newest releases first, the top-tracks fallback. */
function newestLibraryTracks(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => albumYear(b) - albumYear(a));
}

/** The release year of a track's album, 0 when it carries none. */
function albumYear(track: Track): number {
  return (track.album && "year" in track.album && track.album.year) || 0;
}

/** A failing provider must not blank the page, so its row just stays empty. */
async function orEmpty<T>(request: Promise<T[]>): Promise<T[]> {
  try {
    return await request;
  } catch (err) {
    console.error("[useArtistRowData] failed to load a row", err);
    return [];
  }
}
