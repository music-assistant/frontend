import {
  loadAlbumVersions,
  loadArtistReleases,
} from "@/components/album/albumData";
import { albumRows, type AlbumRowId } from "@/components/album/albumRows";
import {
  rowSourceDisplay,
  type RowSource,
} from "@/components/details/rowRegistry";
import { mappingsIdentity, useRowRequests } from "@/composables/useRowRequests";
import { MediaType, type Album } from "@/plugins/api/interfaces";
import { computed, ref, watch, type Ref } from "vue";

/**
 * What the album page's rows show, loaded as the visible rows need them.
 *
 * Each returned list is undefined while its row is still loading. Versions are
 * requested once per album; the artist's releases are requested per source and
 * kept, so switching the "more from this artist" source loads the new one and
 * switching back reuses what was loaded. A response that arrives after the page
 * moved on to another album is dropped. The track list is not here: the listing
 * that renders it loads it itself, with the filters the user set on it.
 *
 * `artistSettled` tells whether the lookup of the full album artist has
 * finished, found or not: an automatic source only settles on an empty library
 * then, once the artist's providers are known.
 */
export function useAlbumRowData(
  album: Ref<Album | undefined>,
  visibleRows: Ref<AlbumRowId[]>,
  artistSettled: Ref<boolean>,
) {
  const versionItems = ref<Album[]>();
  // artist releases per source: switching the source loads the new one and
  // keeps it. Absent = still loading.
  const artistReleases = ref(new Map<RowSource, Album[]>());

  // a new album, or new provider mappings, start from empty rows; anything
  // else (a favorite toggle, a metadata update) keeps what is already loaded
  const { fetchOnce, refetchOnLibraryChange } = useRowRequests(
    album,
    mappingsIdentity,
    () => {
      versionItems.value = undefined;
      artistReleases.value = new Map();
      loadRowData();
    },
  );

  refetchOnLibraryChange(
    { [MediaType.ALBUM]: ["versions", "artist_releases"] },
    () => loadRowData(),
  );

  // the source the user chose for "more from this artist", "auto" included
  const moreFromArtistSelectedSource = computed<RowSource | undefined>(() =>
    album.value
      ? albumRows.effectiveSource("more_from_artist", album.value)
      : undefined,
  );

  // whether the library holds other releases of the artist, which settles an
  // automatic source; an empty library only does once the artist lookup has
  // finished, so the row does not show it on the way to a provider
  const libraryHasReleases = computed(() => {
    const items = artistReleases.value.get("library");
    if (items === undefined) return undefined;
    if (items.length) return true;
    return artistSettled.value ? false : undefined;
  });

  // the source feeding "more from this artist"; it follows the full album artist
  // once loaded into album.artists[0], so a saved provider becomes effective then
  const moreFromArtistSource = computed<RowSource | undefined>(() =>
    album.value
      ? albumRows.resolveSource(
          "more_from_artist",
          album.value,
          libraryHasReleases.value,
        )
      : undefined,
  );

  const artistReleaseItems = computed(() =>
    moreFromArtistSource.value
      ? artistReleases.value.get(moreFromArtistSource.value)
      : undefined,
  );

  // an automatic row's badge reads "Automatic" until its source is known
  const moreFromArtistSourceDisplay = computed(() =>
    rowSourceDisplay(
      moreFromArtistSource.value ?? moreFromArtistSelectedSource.value,
    ),
  );

  // unhiding a row in the editor, or switching the artist source, loads what it
  // needs without re-requesting what is already on its way
  watch([visibleRows, moreFromArtistSource], () => loadRowData());

  /** Request what the visible rows need, skipping what is already on its way. */
  function loadRowData() {
    if (!album.value) return;
    const rows = visibleRows.value;
    if (rows.includes("other_versions")) {
      fetchOnce(
        "versions",
        loadAlbumVersions,
        (items) => (versionItems.value = items),
      );
    }
    // an automatic source loads the library's releases, which settle it and
    // bring it back to the library after a library change
    if (rows.includes("more_from_artist")) {
      if (moreFromArtistSelectedSource.value === "auto") {
        fetchArtistReleases("library");
      }
      fetchArtistReleases(moreFromArtistSource.value ?? "library");
    }
  }

  function fetchArtistReleases(source: RowSource) {
    return fetchOnce(
      `artist_releases:${source}`,
      (album) => loadArtistReleases(album, source),
      (items) => artistReleases.value.set(source, items),
    );
  }

  return {
    versionItems,
    artistReleaseItems,
    moreFromArtistSource,
    moreFromArtistSelectedSource,
    moreFromArtistSourceDisplay,
  };
}
