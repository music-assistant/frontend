import type { MediaItem } from "@/plugins/api/interfaces";

/**
 * Returns the item with the uri the server derives from its provider, media
 * type and item id, unless the caller supplied a uri of their own.
 */
export function withUri<T extends Omit<MediaItem, "uri">>(
  item: T & { uri?: string },
): T & { uri: string } {
  return {
    ...item,
    uri: item.uri ?? `${item.provider}://${item.media_type}/${item.item_id}`,
  };
}
