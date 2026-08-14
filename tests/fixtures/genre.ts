import { type Genre, MediaType } from "@/plugins/api/interfaces";
import { withUri } from "./mediaItem";

/**
 * A complete genre, for tests that only care about a few of its fields but
 * should still model a payload the server can send.
 */
export function genre(overrides: Partial<Genre> = {}): Genre {
  return withUri<Omit<Genre, "uri">>({
    item_id: "1",
    provider: "library",
    name: "Genre",
    version: "",
    external_ids: [],
    is_playable: false,
    media_type: MediaType.GENRE,
    provider_mappings: [],
    metadata: {},
    favorite: false,
    genre_aliases: null,
    ...overrides,
  });
}
