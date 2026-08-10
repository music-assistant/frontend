import { type Genre, MediaType } from "@/plugins/api/interfaces";

/**
 * A complete genre, for tests that only care about a few of its fields but
 * should still model a payload the server can send.
 */
export function genre(overrides: Partial<Genre> = {}): Genre {
  return {
    item_id: "1",
    provider: "library",
    name: "Genre",
    version: "",
    uri: "library://genre/1",
    external_ids: [],
    is_playable: false,
    media_type: MediaType.GENRE,
    provider_mappings: [],
    metadata: {},
    favorite: false,
    genre_aliases: null,
    ...overrides,
  };
}
