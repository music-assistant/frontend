import { type Album, AlbumType, MediaType } from "@/plugins/api/interfaces";

/**
 * A complete album, for tests that only care about a few of its fields but
 * should still model a payload the server can send.
 */
export function album(overrides: Partial<Album> = {}): Album {
  return {
    item_id: "1",
    provider: "library",
    name: "Album",
    uri: "library://album/1",
    is_playable: true,
    media_type: MediaType.ALBUM,
    provider_mappings: [],
    metadata: {},
    favorite: false,
    album_type: AlbumType.ALBUM,
    artists: [],
    ...overrides,
  };
}
