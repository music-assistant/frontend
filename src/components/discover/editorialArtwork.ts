import { getImageThumbForItem } from "@/helpers/utils";
import {
  ImageType,
  type ItemMapping,
  type MediaItemType,
  MediaType,
} from "@/plugins/api/interfaces";

type AnyItem = MediaItemType | ItemMapping;

// Items without artwork (and genres, whose images are icons) use the MA
// banner artwork as background (matches the "Browse by genre" tiles on the
// home screen).
const bannerArtwork = new URL(
  "@/assets/logo/banner-no-logo.png",
  import.meta.url,
).href;

/** Up-to-two-letter initials from a name (first letters of the first two
 * words, or the first two characters of a single word). */
export function itemInitials(name: string): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Resolve the real cover-art URL for a media item, falling back to the MA
 * banner artwork when no artwork is available.
 */
export function itemArtwork(
  item: AnyItem,
  size = 320,
): { image: string | undefined; gradient: string; initials?: string } {
  const image = getImageThumbForItem(item, ImageType.THUMB, size);
  // For artists/albums with no artwork, surface the initials over the banner.
  const showInitials =
    !image &&
    (item.media_type === MediaType.ARTIST ||
      item.media_type === MediaType.ALBUM);
  return {
    image,
    gradient: `url("${bannerArtwork}") center / cover no-repeat`,
    initials: showInitials ? itemInitials(item.name) : undefined,
  };
}
