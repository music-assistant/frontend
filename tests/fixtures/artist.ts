import { type Artist, ArtistType, MediaType } from "@/plugins/api/interfaces";

/**
 * A complete artist, for tests that only care about a few of its fields but
 * should still model a payload the server can send.
 */
export function artist(overrides: Partial<Artist> = {}): Artist {
  return {
    item_id: "1",
    provider: "library",
    name: "Artist",
    version: "",
    uri: "library://artist/1",
    external_ids: [],
    is_playable: true,
    media_type: MediaType.ARTIST,
    provider_mappings: [],
    metadata: {},
    favorite: false,
    artist_type: ArtistType.SINGER,
    ...overrides,
  };
}
