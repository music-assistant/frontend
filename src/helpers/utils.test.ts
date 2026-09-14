import { ImageType } from "@/plugins/api/interfaces";
import type { MediaItemImage, MediaItemType } from "@/plugins/api/interfaces";
import { describe, expect, it, vi } from "vitest";

// only `getProvider` matters here: it decides whether an image is considered
// fetchable. An unloaded/disabled provider is absent from the map entirely.
vi.mock("@/plugins/api", () => ({
  api: {
    baseUrl: "http://server",
    providers: {},
    getProvider: (id: string) =>
      id === "filesystem--loaded" ? { available: true } : undefined,
  },
}));

const { getMediaItemImage } = await import("./utils");

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
});
