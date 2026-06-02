import { getImageThumbForItem } from "@/helpers/utils";
import {
  ImageType,
  type ItemMapping,
  type MediaItemType,
  MediaType,
} from "@/plugins/api/interfaces";

type AnyItem = MediaItemType | ItemMapping;

/** Up-to-two-letter initials from a name (first letters of the first two
 * words, or the first two characters of a single word). */
export function itemInitials(name: string): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Generate a deterministic CSS gradient background from any seed string.
 * The same seed always yields the same gradient.
 */
export function gradientArtwork(seed: string): string {
  const h = hash(String(seed));
  const style = (["radial", "linear", "conic", "mesh"] as const)[h % 4];
  const hue1 = h % 360;
  const hue2 = (hue1 + 40 + ((h >> 7) % 120)) % 360;
  const hue3 = (hue1 + 180 + ((h >> 14) % 60)) % 360;
  const sat = 60 + ((h >> 5) % 30);
  const l1 = 48 + ((h >> 11) % 18);
  const l2 = 28 + ((h >> 17) % 14);
  const l3 = 38 + ((h >> 19) % 18);
  const cx = (h >> 3) % 100;
  const cy = (h >> 6) % 100;
  const ang = (h >> 9) % 360;

  if (style === "radial") {
    return `radial-gradient(circle at ${cx}% ${cy}%, hsl(${hue1} ${sat}% ${l1}%) 0%, hsl(${hue2} ${sat}% ${l2}%) 60%, hsl(${hue3} ${sat - 10}% ${l2 - 5}%) 100%)`;
  } else if (style === "linear") {
    return `linear-gradient(${ang}deg, hsl(${hue1} ${sat}% ${l1}%), hsl(${hue2} ${sat}% ${l2}%) 50%, hsl(${hue3} ${sat}% ${l3}%))`;
  } else if (style === "conic") {
    return `conic-gradient(from ${ang}deg at ${cx}% ${cy}%, hsl(${hue1} ${sat}% ${l1}%), hsl(${hue2} ${sat}% ${l2}%), hsl(${hue3} ${sat}% ${l3}%), hsl(${hue1} ${sat}% ${l1}%))`;
  }

  return `radial-gradient(at ${cx}% ${cy}%, hsl(${hue1} ${sat}% ${l1}% / .9), transparent 60%), radial-gradient(at ${100 - cx}% ${100 - cy}%, hsl(${hue2} ${sat}% ${l2}% / .9), transparent 60%), radial-gradient(at 50% 50%, hsl(${hue3} ${sat}% ${l3}%), hsl(${hue3} ${sat}% ${l3 - 10}%))`;
}

/** Pick a stable seed for a media item. */
export function itemSeed(item: AnyItem): string {
  return item.uri || item.name || item.item_id || "ma";
}

/**
 * Resolve the real cover-art URL for a media item, falling back to a
 * deterministic gradient when no artwork is available.
 */
export function itemArtwork(
  item: AnyItem,
  size = 320,
): { image: string | undefined; gradient: string; initials?: string } {
  const image = getImageThumbForItem(item, ImageType.THUMB, size);
  // For artists/albums with no artwork, surface the initials over the gradient.
  const showInitials =
    !image &&
    (item.media_type === MediaType.ARTIST ||
      item.media_type === MediaType.ALBUM);
  return {
    image,
    gradient: gradientArtwork(itemSeed(item)),
    initials: showInitials ? itemInitials(item.name) : undefined,
  };
}
