import type { ArtistRowId } from "@/components/artist/artistRows";
import { updateUserPreferences } from "@/composables/userPreferences";
import {
  discographyTypesSummary,
  validDiscographyTypes,
  withDiscographyTypeToggled,
} from "@/helpers/discography_types";
import { AlbumType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";

export type DiscographyRowId = Extract<
  ArtistRowId,
  "discography" | "discography_second"
>;

export const DISCOGRAPHY_ROWS: readonly DiscographyRowId[] = [
  "discography",
  "discography_second",
];

// the user preference holding each discography row's release types,
// e.g. { discography: ["album"], discography_second: ["live"] }
export const DISCOGRAPHY_TYPES_PREFERENCE_KEY = "artist.discographyTypes";

// the url query a "View all" link carries a row's types in, e.g. "album,live"
export const DISCOGRAPHY_TYPES_QUERY = "types";

const DEFAULT_TYPES: Record<DiscographyRowId, AlbumType[]> = {
  discography: [AlbumType.ALBUM],
  discography_second: [AlbumType.LIVE],
};

export function isDiscographyRow(
  rowId: ArtistRowId,
): rowId is DiscographyRowId {
  return (DISCOGRAPHY_ROWS as readonly ArtistRowId[]).includes(rowId);
}

/** The release types a discography row shows, the same for every artist. */
export function discographyTypes(rowId: DiscographyRowId): AlbumType[] {
  return typesIn(store.currentUser?.preferences ?? {}, rowId);
}

/** A short summary of release types, e.g. "Albums +2". */
export function discographyTypesLabel(types: readonly AlbumType[]): string {
  return discographyTypesSummary(
    types,
    (type) => $t(`album_type_plural.${type}`),
    (first, count) => $t("discography_types_summary", { first, count }),
  );
}

/** Tick or untick a release type on a discography row; its last type stays. */
export async function toggleDiscographyType(
  rowId: DiscographyRowId,
  type: AlbumType,
): Promise<void> {
  // toggled on the types saved when this write's turn comes, so quick ticks
  // queued behind a save build on each other
  await updateUserPreferences((current) => ({
    ...current,
    [DISCOGRAPHY_TYPES_PREFERENCE_KEY]: {
      ...asObject(current[DISCOGRAPHY_TYPES_PREFERENCE_KEY]),
      [rowId]: withDiscographyTypeToggled(typesIn(current, rowId), type),
    },
  }));
}

/** The row's types in these preferences, or its default when unset or invalid. */
function typesIn(
  preferences: Record<string, unknown>,
  rowId: DiscographyRowId,
): AlbumType[] {
  const saved = validDiscographyTypes(
    asObject(preferences[DISCOGRAPHY_TYPES_PREFERENCE_KEY])[rowId],
  );
  return saved.length ? saved : DEFAULT_TYPES[rowId];
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
