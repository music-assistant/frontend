import {
  createRowRegistry,
  type RowDefinition,
} from "@/components/details/rowRegistry";
import type { Genre } from "@/plugins/api/interfaces";

export type GenreRowId =
  "artists" | "albums" | "tracks" | "playlists" | "podcasts" | "audiobooks";

export const GENRE_ROWS: readonly RowDefinition<GenreRowId>[] = [
  { id: "artists", labelKey: "artists" },
  { id: "albums", labelKey: "albums" },
  { id: "tracks", labelKey: "tracks" },
  { id: "playlists", labelKey: "playlists" },
  { id: "podcasts", labelKey: "podcasts" },
  { id: "audiobooks", labelKey: "audiobooks" },
];

export const GENRE_ROW_IDS: GenreRowId[] = GENRE_ROWS.map((row) => row.id);

export const genreRows = createRowRegistry<GenreRowId, Genre>({
  rows: GENRE_ROWS,
  preferenceKey: "genre.rows",
});
