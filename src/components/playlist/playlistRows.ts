import {
  createRowRegistry,
  type RowDefinition,
} from "@/components/details/rowRegistry";
import type { Playlist } from "@/plugins/api/interfaces";

export type PlaylistRowId = "tracks" | "description" | "provider_mappings";

// default order; no row has a source picker, every row shows the playlist itself
export const PLAYLIST_ROWS: readonly RowDefinition<PlaylistRowId>[] = [
  { id: "tracks", labelKey: "tracks" },
  { id: "description", labelKey: "description" },
  { id: "provider_mappings", labelKey: "source_details" },
];

export const PLAYLIST_ROWS_PREFERENCE_KEY = "playlist.rows";

/** Row ids the playlist page can show, in default order. */
export function availablePlaylistRowIds(): PlaylistRowId[] {
  return PLAYLIST_ROWS.map((row) => row.id);
}

/** The playlist page's rows and the user's customization of them. */
export const playlistRows = createRowRegistry<PlaylistRowId, Playlist>({
  rows: PLAYLIST_ROWS,
  preferenceKey: PLAYLIST_ROWS_PREFERENCE_KEY,
});
