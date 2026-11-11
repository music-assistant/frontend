import {
  ArtistType,
  MediaType,
  type MediaItemTypeOrItemMapping,
} from "@/plugins/api/interfaces";

const AUDIOBOOK_ARTIST_TYPES = [ArtistType.AUTHOR, ArtistType.NARRATOR];

// an item mapping carries no artist type, so it counts as a singer
export function isAuthorOrNarrator(item: MediaItemTypeOrItemMapping): boolean {
  return (
    item.media_type === MediaType.ARTIST &&
    "artist_type" in item &&
    AUDIOBOOK_ARTIST_TYPES.includes(item.artist_type)
  );
}

// translation key naming what the item is, so an author reads as such
export function getItemTypeLabelKey(item: MediaItemTypeOrItemMapping): string {
  return isAuthorOrNarrator(item) && "artist_type" in item
    ? item.artist_type
    : item.media_type;
}
