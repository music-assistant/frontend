import {
  ImageType,
  type MediaItem,
  type MediaItemImage,
} from "@/plugins/api/interfaces";

export { readFileAsBase64 } from "@/helpers/dspIR";

// Must match MAX_CUSTOM_IMAGE_BYTES in the server's images helper. Checked
// against the raw file, before base64 encoding inflates it by ~4/3.
export const MAX_CUSTOM_IMAGE_BYTES = 10 * 1024 * 1024;

// The server accepts any raster format it can decode (validated from the
// actual content, SVG rejected); the picker hint stays broad on purpose.
export const CUSTOM_IMAGE_ACCEPT = "image/*";

// Relative path prefix the server uses for user-uploaded custom images.
const CUSTOM_IMAGES_PATH_PREFIX = "custom_images/";

// Returns the item's user-uploaded custom image of the given type, if any.
export function getCustomImage(
  item: MediaItem,
  type: ImageType = ImageType.THUMB,
): MediaItemImage | undefined {
  return item.metadata?.images?.find(
    (img: MediaItemImage) =>
      img.type === type &&
      img.provider === "builtin" &&
      img.path.startsWith(CUSTOM_IMAGES_PATH_PREFIX),
  );
}
