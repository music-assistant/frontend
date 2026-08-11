import { MediaType, type Podcast } from "@/plugins/api/interfaces";
import { withUri } from "./mediaItem";

/**
 * A complete podcast, for tests that only care about a few of its fields but
 * should still model a payload the server can send.
 */
export function podcast(overrides: Partial<Podcast> = {}): Podcast {
  return withUri<Omit<Podcast, "uri">>({
    item_id: "1",
    provider: "library",
    name: "Podcast",
    version: "",
    external_ids: [],
    is_playable: true,
    media_type: MediaType.PODCAST,
    provider_mappings: [],
    metadata: {},
    favorite: false,
    publisher: null,
    total_episodes: null,
    ...overrides,
  });
}
