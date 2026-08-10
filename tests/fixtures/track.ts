import { MediaType, type Track } from "@/plugins/api/interfaces";

/**
 * A complete track, for tests that only care about a few of its fields but
 * should still model a payload the server can send.
 */
export function track(overrides: Partial<Track> = {}): Track {
  return {
    item_id: "1",
    provider: "library",
    name: "Track",
    version: "",
    uri: "library://track/1",
    external_ids: [],
    is_playable: true,
    media_type: MediaType.TRACK,
    provider_mappings: [],
    metadata: {},
    favorite: false,
    duration: 200,
    artists: [],
    album: null,
    disc_number: 0,
    track_number: 0,
    ...overrides,
  };
}
