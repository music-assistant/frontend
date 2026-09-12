import {
  loadSimilarTracks,
  loadTrackAlbums,
  loadTrackLyrics,
  loadTrackVersions,
} from "@/components/track/trackData";
import type { TrackRowId } from "@/components/track/trackRows";
import { useRowRequests } from "@/composables/useRowRequests";
import type { Album, Track } from "@/plugins/api/interfaces";
import { ref, watch, type Ref } from "vue";

/**
 * What every row of the track page shows, loaded as the visible rows need it.
 *
 * Each returned list is undefined while its row is still loading; the lyrics
 * are `[text]`, or `[]` when nobody has any. Each list is requested once per
 * track, and a response that arrives after the page moved on to another track
 * is dropped.
 */
export function useTrackRowData(
  track: Ref<Track | undefined>,
  visibleRows: Ref<TrackRowId[]>,
) {
  const lyrics = ref<string[]>();
  const appearsOnItems = ref<Album[]>();
  const versionItems = ref<Track[]>();
  const similarItems = ref<Track[]>();

  // a new track, or new provider mappings, start from empty rows; anything
  // else (a favorite toggle, a metadata update) keeps what is already loaded
  const { fetchOnce } = useRowRequests(track, rowsIdentity, () => {
    lyrics.value = undefined;
    appearsOnItems.value = undefined;
    versionItems.value = undefined;
    similarItems.value = undefined;
    loadRowData();
  });

  // unhiding a row in the editor loads what it needs, without re-requesting
  // what the visible rows already have
  watch(visibleRows, () => loadRowData());

  /** Request what the visible rows need, skipping what is already on its way. */
  function loadRowData() {
    if (!track.value) return;
    const rows = visibleRows.value;
    if (rows.includes("lyrics")) {
      fetchOnce(
        "lyrics",
        async (track) => {
          const text = await loadTrackLyrics(track);
          return text ? [text] : [];
        },
        (items) => (lyrics.value = items),
      );
    }
    if (rows.includes("appears_on")) {
      fetchOnce(
        "albums",
        loadTrackAlbums,
        (items) => (appearsOnItems.value = items),
      );
    }
    if (rows.includes("other_versions")) {
      fetchOnce(
        "versions",
        loadTrackVersions,
        (items) => (versionItems.value = items),
      );
    }
    if (rows.includes("similar_tracks")) {
      fetchOnce(
        "similar",
        loadSimilarTracks,
        (items) => (similarItems.value = items),
      );
    }
  }

  return { lyrics, appearsOnItems, versionItems, similarItems };
}

/** What the rows are loaded from: the track and the providers it is mapped to. */
function rowsIdentity(track: Track): string {
  const mappings = track.provider_mappings
    .map((mapping) => `${mapping.provider_instance}:${mapping.item_id}`)
    .sort();
  return [track.uri, ...mappings].join("|");
}
