import { getImageThumbForItem } from "@/helpers/utils";
import {
  ImageType,
  type ItemMapping,
  type MediaItemType,
} from "@/plugins/api/interfaces";

export interface HeroBackdrop {
  // undefined when there is no artwork at all
  url?: string;
  // the cover standing in for missing wide art, which the hero blurs so it
  // reads as colour instead of a second copy of the cover beside it
  blurred: boolean;
}

/**
 * The artwork behind a detail hero: wide art (fanart, then landscape) of the
 * item, else of the related items in order (e.g. its artist or podcast), else
 * the item's cover to blur. No size is passed, so the server serves the
 * original image.
 */
export function heroBackdrop(
  item: MediaItemType,
  ...related: (MediaItemType | ItemMapping | undefined)[]
): HeroBackdrop {
  for (const source of [item, ...related]) {
    const wide =
      getImageThumbForItem(source, ImageType.FANART) ||
      getImageThumbForItem(source, ImageType.LANDSCAPE);
    if (wide) return { url: wide, blurred: false };
  }
  return { url: getImageThumbForItem(item, ImageType.THUMB), blurred: true };
}
