import { MediaType, type Radio } from "@/plugins/api/interfaces";

/**
 * A complete radio station, for tests that only care about a few of its fields
 * but should still model a payload the server can send.
 */
export function radio(overrides: Partial<Radio> = {}): Radio {
  return {
    item_id: "1",
    provider: "library",
    name: "Radio",
    version: "",
    uri: "library://radio/1",
    external_ids: [],
    is_playable: true,
    media_type: MediaType.RADIO,
    provider_mappings: [],
    metadata: {},
    favorite: false,
    ...overrides,
  };
}
