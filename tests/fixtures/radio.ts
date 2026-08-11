import { MediaType, type Radio } from "@/plugins/api/interfaces";
import { withUri } from "./mediaItem";

/**
 * A complete radio station, for tests that only care about a few of its fields
 * but should still model a payload the server can send.
 */
export function radio(overrides: Partial<Radio> = {}): Radio {
  return withUri<Omit<Radio, "uri">>({
    item_id: "1",
    provider: "library",
    name: "Radio",
    version: "",
    external_ids: [],
    is_playable: true,
    media_type: MediaType.RADIO,
    provider_mappings: [],
    metadata: {},
    favorite: false,
    ...overrides,
  });
}
