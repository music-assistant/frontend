import {
  loadAlbumVersions,
  loadArtistReleases,
} from "@/components/album/albumData";
import type { AlbumRowId } from "@/components/album/albumRows";
import { mappingsIdentity, useRowRequests } from "@/composables/useRowRequests";
import type { Album } from "@/plugins/api/interfaces";
import { ref, watch, type Ref } from "vue";

/**
 * What the album page's rows show, loaded as the visible rows need them.
 *
 * Each returned list is undefined while its row is still loading. Each is
 * requested once per album, and a response that arrives after the page moved on
 * to another album is dropped. The track list is not here: the listing that
 * renders it loads it itself, with the filters the user set on it.
 */
export function useAlbumRowData(
  album: Ref<Album | undefined>,
  visibleRows: Ref<AlbumRowId[]>,
) {
  const versionItems = ref<Album[]>();
  const artistReleases = ref<Album[]>();

  // a new album, or new provider mappings, start from empty rows; anything
  // else (a favorite toggle, a metadata update) keeps what is already loaded
  const { fetchOnce } = useRowRequests(album, mappingsIdentity, () => {
    versionItems.value = undefined;
    artistReleases.value = undefined;
    loadRowData();
  });

  // unhiding a row in the editor loads what it needs, without re-requesting
  // what the visible rows already have
  watch(visibleRows, () => loadRowData());

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
    if (rows.includes("more_from_artist")) {
      fetchOnce(
        "artist_releases",
        loadArtistReleases,
        (items) => (artistReleases.value = items),
      );
    }
  }

  return { versionItems, artistReleases };
}
