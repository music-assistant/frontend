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
// home screen). Exported so non-media cards (e.g. AI Radio shows) can use
// the same fallback treatment.
export const bannerArtwork = new URL(
  "@/assets/logo/banner-no-logo.png",
  import.meta.url,
).href;

export const bannerBackground = `url("${bannerArtwork}") center / cover no-repeat`;

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
  preferFanart = false,
): { image: string | undefined; gradient: string; initials?: string } {
  // When requested, prefer wide fanart for the background and fall back to the
  // regular thumbnail art (which itself falls back to landscape) when none.
  const image = preferFanart
    ? (getImageThumbForItem(item, ImageType.FANART, size) ??
      getImageThumbForItem(item, ImageType.THUMB, size))
    : getImageThumbForItem(item, ImageType.THUMB, size);
  // For artists/albums with no artwork, surface the initials over the banner.
  const showInitials =
    !image &&
    (item.media_type === MediaType.ARTIST ||
      item.media_type === MediaType.ALBUM);
  const useBanner = !image || item.media_type === MediaType.GENRE;
  const bannerGradient = `url("${bannerArtwork}") center / cover no-repeat`;
  const placeholder = "rgba(var(--v-theme-on-surface), 0.08)";

  return {
    image,
    gradient: useBanner ? bannerGradient : placeholder,
    initials: showInitials ? itemInitials(item.name) : undefined,
  };
}
