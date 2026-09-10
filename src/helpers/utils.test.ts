import { ImageType } from "@/plugins/api/interfaces";
import type {
  MediaItemImage,
  MediaItemType,
  QueueItem,
} from "@/plugins/api/interfaces";
import { describe, expect, it, vi } from "vitest";

// `getProvider` decides whether an image is considered fetchable: an
// unloaded/disabled provider is absent from the map entirely. `schema_version`
// picks the imageproxy dialect, 31 and up serve the opaque id form only.
vi.mock("@/plugins/api", () => ({
  api: {
    baseUrl: "http://server",
    providers: {},
    serverInfo: { value: { schema_version: 31 } },
    getProvider: (id: string) =>
      id === "filesystem--loaded" ? { available: true } : undefined,
  },
}));

const { getMediaItemImage, getMediaItemImageUrl } = await import("./utils");

const image = (
  provider: string,
  remotely_accessible: boolean,
  path = "cover.jpg",
): MediaItemImage =>
  ({
    type: ImageType.THUMB,
    path,
    provider,
    remotely_accessible,
  }) as MediaItemImage;

const albumWith = (images: MediaItemImage[]) =>
  ({ name: "Black to the Blind", metadata: { images } }) as MediaItemType;

describe("getMediaItemImage", () => {
  it("keeps a remote image whose provider is no longer loaded", () => {
    // artwork written by a metadata provider that has since been disabled: the
    // url is self-contained, so the server can still resolve and resize it
    const img = image("theaudiodb", true, "https://r2.theaudiodb.com/a.jpg");
    expect(getMediaItemImage(albumWith([img]))).toEqual(img);
  });

  it("skips a provider-relative image whose provider is no longer loaded", () => {
    // a bare path means only that provider can say what it is relative to
    const stale = image("filesystem--gone", false, "Vader/01.mp3");
    const usable = image("filesystem--loaded", false, "Vader/02.mp3");
    expect(getMediaItemImage(albumWith([stale, usable]))).toEqual(usable);
  });

  it("returns nothing when no image is fetchable", () => {
    const stale = image("filesystem--gone", false, "Vader/01.mp3");
    expect(getMediaItemImage(albumWith([stale]))).toBeUndefined();
  });

  it("applies the same rule to the single image on a summary item", () => {
    // summary/playlog items carry one image only, so a discarded image leaves
    // no second candidate and the item falls back to a generated avatar
    const img = image("theaudiodb", true, "https://r2.theaudiodb.com/a.jpg");
    const summaryItem = { name: "Berserker", image: img } as MediaItemType;
    expect(getMediaItemImage(summaryItem)).toEqual(img);
  });

  it("prefers a radio stream's live artwork over the station's own image", () => {
    // a station's own image is generic, while it plays, the live ICY/stream
    // metadata carries the artwork for the track actually on air
    const queueItem = {
      media_item: albumWith([image("theaudiodb", true, "station.jpg")]),
      streamdetails: {
        stream_metadata: { image_url: "https://stream.example/cover.jpg" },
      },
    } as unknown as QueueItem;

    expect(getMediaItemImage(queueItem)).toEqual({
      type: ImageType.THUMB,
      path: "https://stream.example/cover.jpg",
      provider: "builtin",
      remotely_accessible: true,
    });
  });
});

describe("getMediaItemImageUrl", () => {
  it("addresses an image that has a proxy_id by its opaque id", () => {
    const img = { ...image("filesystem--loaded", false), proxy_id: "abc123" };
    expect(getMediaItemImageUrl(img, 256)).toBe(
      "http://server/imageproxy/abc123?size=256",
    );
  });

  it("falls back to the url itself for an image with no proxy_id", () => {
    // a server that issues opaque ids refuses the legacy path-based form, so
    // the proxy is no route for an image it never handed an id to, as with
    // one built from a radio stream's live metadata
    const img = image("builtin", true, "https://stream.example/cover.jpg");
    expect(getMediaItemImageUrl(img, 256)).toBe(
      "https://stream.example/cover.jpg",
    );
  });
});
