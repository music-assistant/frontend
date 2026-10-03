import {
  ImageType,
  MediaType,
  type MediaItemImage,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { describe, expect, it, vi } from "vitest";

// An image only resolves when its provider is loaded, so builtin must count.
vi.mock("@/plugins/api", () => ({
  api: {
    baseUrl: "http://server",
    providers: {},
    serverInfo: { value: { schema_version: 31 } },
    getProvider: (id: string) =>
      id === "builtin" ? { available: true } : undefined,
  },
}));

const {
  bannerBackground,
  itemArtwork,
  placeholderArtwork,
  placeholderBackground,
} = await import("./editorialArtwork");

const image = (path: string): MediaItemImage =>
  ({
    type: ImageType.THUMB,
    path,
    provider: "builtin",
    remotely_accessible: false,
    proxy_id: path,
  }) as MediaItemImage;

const itemWith = (media_type: MediaType, images: MediaItemImage[]) =>
  ({ name: "Blues", media_type, metadata: { images } }) as MediaItemType;

describe("itemArtwork", () => {
  it("puts a genre's builtin icon on the banner", () => {
    const genre = itemWith(MediaType.GENRE, [image("genres/blues.svg")]);
    const artwork = itemArtwork(genre);
    expect(artwork.image).toBeTruthy();
    expect(artwork.gradient).toBe(bannerBackground);
  });

  it("treats a genre's custom image as real cover art", () => {
    const genre = itemWith(MediaType.GENRE, [
      image("genres/blues.svg"),
      image("custom_images/abc.png"),
    ]);
    const artwork = itemArtwork(genre);
    expect(artwork.image).toBeTruthy();
    expect(artwork.gradient).toBe(placeholderBackground);
  });

  it("uses the flat background for a non-genre item with an image", () => {
    const album = itemWith(MediaType.ALBUM, [image("cover.jpg")]);
    const artwork = itemArtwork(album);
    expect(artwork.image).toBeTruthy();
    expect(artwork.gradient).toBe(placeholderBackground);
  });

  it("falls back to the placeholder when there is no image", () => {
    const album = itemWith(MediaType.ALBUM, []);
    expect(itemArtwork(album)).toEqual(placeholderArtwork(album));
    expect(itemArtwork(album).image).toBeUndefined();
    expect(itemArtwork(album).gradient).toBe(bannerBackground);
  });
});
