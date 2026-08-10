import { MediaType, type Playlist } from "@/plugins/api/interfaces";
import { withUri } from "./mediaItem";

/**
 * A complete playlist, for tests that only care about a few of its fields but
 * should still model a payload the server can send.
 */
export function playlist(overrides: Partial<Playlist> = {}): Playlist {
  return withUri<Omit<Playlist, "uri">>({
    item_id: "1",
    provider: "library",
    name: "Playlist",
    version: "",
    external_ids: [],
    is_playable: true,
    media_type: MediaType.PLAYLIST,
    provider_mappings: [],
    metadata: {},
    favorite: false,
    owner: "",
    is_editable: false,
    supported_mediatypes: [MediaType.TRACK],
    is_dynamic: false,
    ...overrides,
  });
}
