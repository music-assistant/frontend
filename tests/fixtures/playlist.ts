import { MediaType, type Playlist } from "@/plugins/api/interfaces";

/**
 * A complete playlist, for tests that only care about a few of its fields but
 * should still model a payload the server can send.
 */
export function playlist(overrides: Partial<Playlist> = {}): Playlist {
  return {
    item_id: "1",
    provider: "library",
    name: "Playlist",
    version: "",
    uri: "library://playlist/1",
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
  };
}
