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
