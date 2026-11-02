import type { ArtistRowId } from "@/components/artist/artistRows";
import { updateUserPreferences } from "@/composables/userPreferences";
import { validDiscographyTypes } from "@/helpers/discography_types";
import { AlbumType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";

export type DiscographyRowId = Extract<
  ArtistRowId,
  "discography" | "discography_more"
>;

export const DISCOGRAPHY_ROWS: readonly DiscographyRowId[] = [
  "discography",
  "discography_more",
];

// the user preference holding each discography row's release types,
// e.g. { discography: ["album"], discography_more: ["live"] }
export const DISCOGRAPHY_TYPES_PREFERENCE_KEY = "artist.discographyTypes";

// the url query a "View all" link carries a row's types in, e.g. "album,live"
export const DISCOGRAPHY_TYPES_QUERY = "types";

const DEFAULT_TYPES: Record<DiscographyRowId, AlbumType[]> = {
  discography: [AlbumType.ALBUM],
  discography_more: [AlbumType.LIVE],
};

export function isDiscographyRow(
  rowId: ArtistRowId,
): rowId is DiscographyRowId {
  return (DISCOGRAPHY_ROWS as readonly ArtistRowId[]).includes(rowId);
}

/** The release types a discography row shows, the same for every artist. */
export function discographyTypes(rowId: DiscographyRowId): AlbumType[] {
  const saved = validDiscographyTypes(savedTypes()[rowId]);
  return saved.length ? saved : DEFAULT_TYPES[rowId];
}

/** Save the release types a discography row shows; at least one is expected. */
export async function setDiscographyTypes(
  rowId: DiscographyRowId,
  types: AlbumType[],
): Promise<void> {
  await updateUserPreferences((current) => ({
    ...current,
    [DISCOGRAPHY_TYPES_PREFERENCE_KEY]: {
      ...asObject(current[DISCOGRAPHY_TYPES_PREFERENCE_KEY]),
      [rowId]: [...types],
    },
  }));
}

/** The saved `{ [rowId]: types }` object, empty when unset or invalid. */
function savedTypes(): Partial<Record<DiscographyRowId, unknown>> {
  return asObject(
    store.currentUser?.preferences?.[DISCOGRAPHY_TYPES_PREFERENCE_KEY],
  );
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
