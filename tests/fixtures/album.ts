import { type Album, AlbumType, MediaType } from "@/plugins/api/interfaces";
import { withUri } from "./mediaItem";

/**
 * A complete album, for tests that only care about a few of its fields but
 * should still model a payload the server can send.
 */
export function album(overrides: Partial<Album> = {}): Album {
  return withUri<Omit<Album, "uri">>({
    item_id: "1",
    provider: "library",
    name: "Album",
    version: "",
    external_ids: [],
    is_playable: true,
    media_type: MediaType.ALBUM,
    provider_mappings: [],
    metadata: {},
    favorite: false,
    album_type: AlbumType.ALBUM,
    artists: [],
    ...overrides,
  });
}
