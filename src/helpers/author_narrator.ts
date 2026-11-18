import {
  ArtistType,
  MediaType,
  type MediaItemTypeOrItemMapping,
} from "@/plugins/api/interfaces";

export const AUDIOBOOK_ARTIST_TYPES = [ArtistType.AUTHOR, ArtistType.NARRATOR];

// the artist pages of authors and narrators, under the audiobooks section
export const AUDIOBOOK_ARTIST_ROUTE = "audiobookartist";
export const AUDIOBOOK_ARTIST_LISTING_ROUTE = "audiobookartistlisting";

// an item mapping carries no artist type, so it counts as a singer
export function isAuthorOrNarrator(item: MediaItemTypeOrItemMapping): boolean {
  return (
    item.media_type === MediaType.ARTIST &&
    "artist_type" in item &&
    AUDIOBOOK_ARTIST_TYPES.includes(item.artist_type)
  );
}

/** The name of the route that shows the item's details. */
export function detailRouteName(item: MediaItemTypeOrItemMapping): string {
  return isAuthorOrNarrator(item) ? AUDIOBOOK_ARTIST_ROUTE : item.media_type;
}
