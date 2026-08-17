import { type AudioSource, MediaType } from "@/plugins/api/interfaces";
import { withUri } from "./mediaItem";

/**
 * A complete audio source (plugin source such as Spotify Connect or AirPlay),
 * for tests that only care about a few of its fields but should still model
 * a payload the server can send.
 */
export function audioSource(overrides: Partial<AudioSource> = {}): AudioSource {
  return withUri<Omit<AudioSource, "uri">>({
    item_id: "1",
    provider: "library",
    name: "Audio Source",
    version: "",
    external_ids: [],
    is_playable: true,
    media_type: MediaType.AUDIO_SOURCE,
    provider_mappings: [],
    metadata: {},
    favorite: false,
    can_play_pause: true,
    can_seek: false,
    can_next_previous: false,
    exclusive: false,
    allow_external_trigger: false,
    ...overrides,
  });
}
