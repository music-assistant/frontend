import PartyResultItem from "@/components/party/PartyResultItem.vue";
import { AvatarImage } from "@/components/ui/avatar";
import {
  ImageType,
  MediaType,
  type Album,
  type ItemMapping,
  type MediaItemImage,
  type Track,
} from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

const thumb = (path: string): MediaItemImage => ({
  type: ImageType.THUMB,
  path,
  provider: "spotify",
  remotely_accessible: true,
});

const ALBUM_REFERENCE = {
  item_id: "2",
  provider: "library",
  name: "Kind of Blue",
  version: "",
  uri: "library://album/2",
  external_ids: [],
  is_playable: true,
  media_type: MediaType.ALBUM,
  available: true,
  image: thumb("https://images.test/album.jpg"),
} as ItemMapping;

const FULL_ALBUM = {
  item_id: "album-1",
  provider: "spotify",
  name: "Kind of Blue",
  version: "",
  uri: "spotify://album/album-1",
  external_ids: [],
  is_playable: true,
  media_type: MediaType.ALBUM,
  provider_mappings: [],
  metadata: { images: [thumb("https://images.test/album.jpg")] },
  artists: [],
} as unknown as Album;

const track = (album: Album | ItemMapping | null): Track =>
  ({
    item_id: "1",
    provider: "library",
    name: "So What",
    version: "",
    uri: "library://track/1",
    external_ids: [],
    is_playable: true,
    media_type: MediaType.TRACK,
    provider_mappings: [],
    metadata: { images: [thumb("https://images.test/track.jpg")] },
    duration: 300,
    artists: [],
    album,
    disc_number: 1,
    track_number: 1,
  }) as Track;

const imageSrc = (item: Track): string => {
  const wrapper = mount(PartyResultItem, {
    props: {
      item,
      boostEnabled: false,
      addQueueEnabled: false,
      rateLimitingEnabled: false,
      boostTokens: 0,
      addQueueTokens: 0,
      boostBadgeColor: "",
      requestBadgeColor: "",
      addingItems: new Set<string>(),
      addedItems: new Set<string>(),
      queuedUris: new Set<string>(),
      isExpanded: false,
    },
  });
  return String(wrapper.findComponent(AvatarImage).props("src"));
};

describe("PartyResultItem", () => {
  it.each([
    ["an album reference", ALBUM_REFERENCE],
    ["a full album", FULL_ALBUM],
  ])("shows the album cover of a track on %s", (_label, album) => {
    expect(imageSrc(track(album))).toContain("album.jpg");
  });

  it("shows the track's own image when it has no album", () => {
    expect(imageSrc(track(null))).toContain("track.jpg");
  });
});
