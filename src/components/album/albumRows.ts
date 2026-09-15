import {
  createRowRegistry,
  type RowDefinition,
} from "@/components/details/rowRegistry";
import type { Album } from "@/plugins/api/interfaces";

export type AlbumRowId =
  | "tracks"
  | "review"
  | "other_versions"
  | "more_from_artist"
  | "provider_mappings"
  | "artwork"; // admins only

// default order; no row has a source picker, an album is only ever listed by
// the provider it came from
export const ALBUM_ROWS: readonly RowDefinition<AlbumRowId>[] = [
  { id: "tracks", labelKey: "tracks" },
  { id: "review", labelKey: "review" },
  { id: "other_versions", labelKey: "other_versions" },
  { id: "more_from_artist", labelKey: "more_from_artist" },
  { id: "provider_mappings", labelKey: "mapped_providers" },
  { id: "artwork", labelKey: "images", adminOnly: true },
];

export const ALBUM_ROWS_PREFERENCE_KEY = "album.rows";

/** Row ids applicable to the given user, in default order. */
export function availableAlbumRowIds(managesLibrary: boolean): AlbumRowId[] {
  return ALBUM_ROWS.filter((row) => managesLibrary || !row.adminOnly).map(
    (row) => row.id,
  );
}

/** The album page's rows and the user's customization of them. */
export const albumRows = createRowRegistry<AlbumRowId, Album>({
  rows: ALBUM_ROWS,
  preferenceKey: ALBUM_ROWS_PREFERENCE_KEY,
});
