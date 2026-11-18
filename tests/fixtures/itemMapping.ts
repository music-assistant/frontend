import { type ItemMapping, MediaType } from "@/plugins/api/interfaces";
import { withUri } from "./mediaItem";

/**
 * A complete item mapping, for tests that only care about a few of its fields
 * but should still model a payload the server can send.
 */
export function itemMapping(overrides: Partial<ItemMapping> = {}): ItemMapping {
  return withUri<Omit<ItemMapping, "uri">>({
    item_id: "1",
    provider: "library",
    name: "Item",
    version: "",
    external_ids: [],
    is_playable: true,
    media_type: MediaType.ALBUM,
    available: true,
    ...overrides,
  });
}
