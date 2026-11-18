import {
  ArtistType,
  MediaType,
  type MediaItemTypeOrItemMapping,
} from "@/plugins/api/interfaces";
import type { RouteLocationRaw } from "vue-router";

export const AUDIOBOOK_ARTIST_TYPES = [ArtistType.AUTHOR, ArtistType.NARRATOR];

// the artist pages of authors and narrators, under the audiobooks section
export const AUDIOBOOK_ARTIST_ROUTE = "audiobookartist";
export const AUDIOBOOK_ARTIST_LISTING_ROUTE = "audiobookartistlisting";

export type AudiobookArtistRole = "authors" | "narrators";

// an item mapping carries no artist type, so it counts as a singer
export function isAuthorOrNarrator(item: MediaItemTypeOrItemMapping): boolean {
  return (
    item.media_type === MediaType.ARTIST &&
    "artist_type" in item &&
    AUDIOBOOK_ARTIST_TYPES.includes(item.artist_type)
  );
}

/** The role in the address of an author's or narrator's page, none for anything else. */
export function audiobookArtistRole(
  item: MediaItemTypeOrItemMapping,
): AudiobookArtistRole | undefined {
  if (!isAuthorOrNarrator(item) || !("artist_type" in item)) return undefined;
  return item.artist_type === ArtistType.AUTHOR ? "authors" : "narrators";
}

/** The route that shows the item's details. */
export function detailRoute(
  item: MediaItemTypeOrItemMapping,
): RouteLocationRaw {
  const params = { itemId: item.item_id, provider: item.provider };
  const role = audiobookArtistRole(item);
  if (role)
    return { name: AUDIOBOOK_ARTIST_ROUTE, params: { ...params, role } };
  return { name: item.media_type, params };
}
