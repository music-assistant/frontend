import { ImageType, type MediaItemType } from "@/plugins/api/interfaces";
import { describe, expect, it, vi } from "vitest";
import { heroBackdrop } from "./hero_backdrop";

// each test item lists its images as { type: url }
vi.mock("@/helpers/utils", () => ({
  getImageThumbForItem: (
    item: { images?: Record<string, string> } | undefined,
    type: ImageType,
  ) => item?.images?.[type],
}));

const item = (images: Partial<Record<ImageType, string>>) =>
  ({ images }) as unknown as MediaItemType;

describe("heroBackdrop", () => {
  it("prefers the item's fanart, then its landscape art", () => {
    expect(
      heroBackdrop(
        item({ [ImageType.LANDSCAPE]: "land", [ImageType.FANART]: "fan" }),
      ),
    ).toEqual({ url: "fan", blurred: false });
    expect(
      heroBackdrop(
        item({ [ImageType.LANDSCAPE]: "land", [ImageType.THUMB]: "cover" }),
      ),
    ).toEqual({ url: "land", blurred: false });
  });

  it("falls back to wide art of the related items in order", () => {
    const own = item({ [ImageType.THUMB]: "cover" });
    const artist = item({ [ImageType.LANDSCAPE]: "artist-land" });
    const other = item({ [ImageType.FANART]: "other-fan" });
    expect(heroBackdrop(own, undefined, artist, other)).toEqual({
      url: "artist-land",
      blurred: false,
    });
  });

  it("blurs the item's own cover when nothing has wide art", () => {
    const related = item({ [ImageType.THUMB]: "artist-cover" });
    expect(heroBackdrop(item({ [ImageType.THUMB]: "cover" }), related)).toEqual(
      { url: "cover", blurred: true },
    );
    expect(heroBackdrop(item({}))).toEqual({ url: undefined, blurred: true });
  });
});
