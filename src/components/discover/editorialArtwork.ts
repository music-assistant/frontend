import ArtistIcon from "@/components/icons/ArtistIcon.vue";
import { getImageThumbForItem } from "@/helpers/utils";
import {
  ImageType,
  type ItemMapping,
  type MediaItemType,
  MediaType,
} from "@/plugins/api/interfaces";
import { Disc3 } from "@lucide/vue";
import type { Component } from "vue";

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

/** Flat tile background for art that should not sit on the banner. */
export const placeholderBackground = "rgba(var(--v-theme-on-surface), 0.08)";

// the icon the navigation menu shows for each media type that gets one
const PLACEHOLDER_ICONS: Partial<Record<MediaType, Component>> = {
  [MediaType.ARTIST]: ArtistIcon,
  [MediaType.ALBUM]: Disc3,
};

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
): {
  image: string | undefined;
  gradient: string;
  placeholderIcon?: Component;
} {
  // When requested, prefer wide fanart for the background and fall back to the
  // regular thumbnail art (which itself falls back to landscape) when none.
  const image = preferFanart
    ? (getImageThumbForItem(item, ImageType.FANART, size) ??
      getImageThumbForItem(item, ImageType.THUMB, size))
    : getImageThumbForItem(item, ImageType.THUMB, size);
  if (!image) return placeholderArtwork(item);

  return {
    image,
    gradient:
      item.media_type === MediaType.GENRE
        ? bannerBackground
        : placeholderBackground,
  };
}

/**
 * The look of an item whose artwork can not be shown: the banner background,
 * with the menu icon of an artist or album over it. Use it when the real
 * artwork turns out to be unloadable.
 */
export function placeholderArtwork(item: AnyItem): {
  image: undefined;
  gradient: string;
  placeholderIcon?: Component;
} {
  return {
    image: undefined,
    gradient: bannerBackground,
    placeholderIcon: PLACEHOLDER_ICONS[item.media_type],
  };
}
