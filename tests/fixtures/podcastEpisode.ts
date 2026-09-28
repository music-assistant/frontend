import { MediaType, type PodcastEpisode } from "@/plugins/api/interfaces";
import { withUri } from "./mediaItem";
import { podcast } from "./podcast";

/**
 * A complete podcast episode, for tests that only care about a few of its
 * fields but should still model a payload the server can send.
 */
export function podcastEpisode(
  overrides: Partial<PodcastEpisode> = {},
): PodcastEpisode {
  return withUri<Omit<PodcastEpisode, "uri">>({
    item_id: "1",
    provider: "library",
    name: "Episode",
    version: "",
    external_ids: [],
    is_playable: true,
    media_type: MediaType.PODCAST_EPISODE,
    provider_mappings: [],
    metadata: {},
    favorite: null,
    position: 1,
    podcast: podcast(),
    duration: 200,
    fully_played: false,
    resume_position_ms: 0,
    ...overrides,
  });
}
