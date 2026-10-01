import { describe, expect, it, vi } from "vitest";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    serverInfo: { value: null },
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock }));

import { podcastBackdrop } from "@/components/podcast/podcastData";
import { ImageType } from "@/plugins/api/interfaces";
import { podcast } from "../../fixtures/podcast";

function image(type: ImageType, path: string) {
  return { type, path, provider: "builtin", remotely_accessible: true };
}

describe("podcastData", () => {
  describe("podcastBackdrop", () => {
    it("paints fanart ahead of landscape art", () => {
      const show = podcast({
        metadata: {
          images: [
            image(ImageType.LANDSCAPE, "landscape.jpg"),
            image(ImageType.FANART, "fanart.jpg"),
          ],
        },
      });

      const backdrop = podcastBackdrop(show);

      expect(backdrop.url).toContain("fanart.jpg");
      expect(backdrop.blurred).toBe(false);
    });

    it("falls back to landscape art", () => {
      const show = podcast({
        metadata: {
          images: [
            image(ImageType.THUMB, "cover.jpg"),
            image(ImageType.LANDSCAPE, "landscape.jpg"),
          ],
        },
      });

      const backdrop = podcastBackdrop(show);

      expect(backdrop.url).toContain("landscape.jpg");
      expect(backdrop.blurred).toBe(false);
    });

    it("blurs the cover when nothing wide is to be had", () => {
      const show = podcast({
        metadata: { images: [image(ImageType.THUMB, "cover.jpg")] },
      });

      const backdrop = podcastBackdrop(show);

      expect(backdrop.url).toContain("cover.jpg");
      expect(backdrop.blurred).toBe(true);
    });

    it("has no artwork to paint when the podcast has none", () => {
      const backdrop = podcastBackdrop(podcast());

      expect(backdrop).toEqual({ url: undefined, blurred: true });
    });
  });
});
