import { type Artist, ArtistType, MediaType } from "@/plugins/api/interfaces";
import { withUri } from "./mediaItem";

/**
 * A complete artist, for tests that only care about a few of its fields but
 * should still model a payload the server can send.
 */
export function artist(overrides: Partial<Artist> = {}): Artist {
  return withUri<Omit<Artist, "uri">>({
    item_id: "1",
    provider: "library",
    name: "Artist",
    version: "",
    external_ids: [],
    is_playable: true,
    media_type: MediaType.ARTIST,
    provider_mappings: [],
    metadata: {},
    favorite: false,
    artist_type: ArtistType.SINGER,
    ...overrides,
  });
}
