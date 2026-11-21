import { getCustomImage } from "@/helpers/customImage";
import {
  ImageType,
  type MediaItem,
  type MediaItemImage,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";

const image = (
  type: ImageType,
  path: string,
  provider = "builtin",
): MediaItemImage =>
  ({ type, path, provider, remotely_accessible: false }) as MediaItemImage;

const itemWith = (images?: MediaItemImage[]) =>
  ({ name: "Blues", metadata: { images } }) as MediaItem;

describe("getCustomImage", () => {
  it("returns the custom thumb among other images", () => {
    const custom = image(ImageType.THUMB, "custom_images/abc.png");
    const item = itemWith([image(ImageType.THUMB, "genres/blues.svg"), custom]);
    expect(getCustomImage(item)).toEqual(custom);
  });

  it("ignores a builtin genre icon", () => {
    const item = itemWith([image(ImageType.THUMB, "genres/blues.svg")]);
    expect(getCustomImage(item)).toBeUndefined();
  });

  it("ignores a matching path from another provider", () => {
    const item = itemWith([
      image(ImageType.THUMB, "custom_images/abc.png", "filesystem--loaded"),
    ]);
    expect(getCustomImage(item)).toBeUndefined();
  });

  it("only returns a custom image of the requested type", () => {
    const fanart = image(ImageType.FANART, "custom_images/wide.png");
    const item = itemWith([fanart]);
    expect(getCustomImage(item)).toBeUndefined();
    expect(getCustomImage(item, ImageType.FANART)).toEqual(fanart);
  });

  it("returns nothing without metadata", () => {
    expect(getCustomImage({ name: "Blues" } as MediaItem)).toBeUndefined();
  });

  it("returns nothing without images", () => {
    expect(getCustomImage(itemWith(undefined))).toBeUndefined();
    expect(getCustomImage(itemWith([]))).toBeUndefined();
  });
});
