import { artistProvidersForFeature } from "@/components/artist/artistData";
import {
  createRowRegistry,
  type RowDefinition,
  type RowSource,
} from "@/components/details/rowRegistry";
import { ProviderFeature, type Album } from "@/plugins/api/interfaces";

export type AlbumRowId =
  | "tracks"
  | "review"
  | "other_versions"
  | "more_from_artist"
  | "provider_mappings"
  | "artwork"; // admins only

// default order; only "more from this artist" has a source picker, the rest are
// only ever shown by the provider the album came from
export const ALBUM_ROWS: readonly RowDefinition<AlbumRowId>[] = [
  { id: "tracks", labelKey: "tracks" },
  { id: "review", labelKey: "review" },
  { id: "other_versions", labelKey: "other_versions" },
  {
    id: "more_from_artist",
    labelKey: "more_from_artist",
    supportsSource: true,
  },
  { id: "provider_mappings", labelKey: "source_details" },
  { id: "artwork", labelKey: "images", adminOnly: true },
];

export const ALBUM_ROWS_PREFERENCE_KEY = "album.rows";
export const ALBUM_ROW_SOURCES_PREFERENCE_KEY = "album.rowSources";

/** Row ids applicable to the given user, in default order. */
export function availableAlbumRowIds(managesLibrary: boolean): AlbumRowId[] {
  return ALBUM_ROWS.filter((row) => managesLibrary || !row.adminOnly).map(
    (row) => row.id,
  );
}

/**
 * The album page's rows and the user's customization of them.
 *
 * The only row with a source is "more from this artist": its sources belong to
 * the album artist, so they read album.artists[0] once the full artist has been
 * loaded into it. A library artist offers the library and each provider it is
 * mapped to that lists albums; a provider (non-library) artist offers no choice
 * and stays on its own provider.
 */
export const albumRows = createRowRegistry<AlbumRowId, Album>({
  rows: ALBUM_ROWS,
  preferenceKey: ALBUM_ROWS_PREFERENCE_KEY,
  sourcesPreferenceKey: ALBUM_ROW_SOURCES_PREFERENCE_KEY,
  sourceCandidates: albumRowSourceCandidates,
  defaultSource: albumRowDefaultSource,
});

/** The sources the album artist's releases could be fed from, in picker order. */
function albumRowSourceCandidates(id: AlbumRowId, album: Album): RowSource[] {
  if (id !== "more_from_artist") return [];
  const artist = album.artists[0];
  // a slim mapping carries no provider mappings, so the picker stays empty until
  // the full album artist has been loaded into artists[0]
  if (
    !artist ||
    artist.provider !== "library" ||
    !("provider_mappings" in artist)
  ) {
    return [];
  }
  return [
    "library",
    ...artistProvidersForFeature(artist, ProviderFeature.ARTIST_ALBUMS),
  ];
}

/** The source feeding the row when nothing valid is saved. */
function albumRowDefaultSource(
  _id: AlbumRowId,
  album: Album,
  candidates: RowSource[],
): RowSource {
  const artist = album.artists[0];
  if (artist && artist.provider !== "library") return artist.provider;
  return candidates[0] ?? "library";
}
