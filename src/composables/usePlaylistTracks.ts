import type { PlaylistItem } from "@/components/playlist/playlistData";
import { api } from "@/plugins/api";
import { ref } from "vue";

interface PlaylistRef {
  itemId: string;
  provider: string;
}

/**
 * The tracks of the playlist a page shows, loaded once for every part of the
 * page that reads them: the hero, the featured artists and the track table.
 * The track table may restore its own tracks from a previous visit without
 * loading, so the page loads them regardless and the table reuses the request.
 */
export function usePlaylistTracks(playlist: () => PlaylistRef) {
  // undefined until the current playlist's tracks have loaded
  const tracks = ref<PlaylistItem[]>();
  let request: Promise<PlaylistItem[]> | undefined;
  let requestKey: string | undefined;

  /** The playlist's tracks, reusing a request in flight unless refreshing. */
  const load = function (refresh = false): Promise<PlaylistItem[]> {
    const { itemId, provider } = playlist();
    const key = `${provider}/${itemId}`;
    if (!refresh && request && requestKey === key) return request;
    const current = api.getPlaylistTracks(itemId, provider, refresh);
    request = current;
    requestKey = key;
    // only the latest request may set the tracks; a failed one can be retried
    current.then(
      (loaded) => {
        if (request === current) {
          tracks.value = loaded;
          request = undefined;
        }
      },
      () => {
        if (request === current) request = undefined;
      },
    );
    return current;
  };

  /** Forgets the tracks, for a page that moves on to another playlist. */
  const reset = function () {
    tracks.value = undefined;
    request = undefined;
    requestKey = undefined;
  };

  return { tracks, load, reset };
}
