import { type ItemMapping, MediaType } from "@/plugins/api/interfaces";

/**
 * A complete item mapping, for tests that only care about a few of its fields
 * but should still model a payload the server can send.
 */
export function itemMapping(overrides: Partial<ItemMapping> = {}): ItemMapping {
  const {
    item_id = "1",
    provider = "library",
    media_type = MediaType.ALBUM,
  } = overrides;
  return {
    item_id,
    provider,
    name: "Item",
    version: "",
    uri: `${provider}://${media_type}/${item_id}`,
    external_ids: [],
    is_playable: true,
    media_type,
    available: true,
    ...overrides,
  };
}
