import { describe, expect, it, vi } from "vitest";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    serverInfo: { value: null },
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock }));

import { podcastEpisodeBackdrop } from "@/components/podcast/podcastEpisodeData";
import { ImageType } from "@/plugins/api/interfaces";
import { podcast } from "../../fixtures/podcast";
import { podcastEpisode } from "../../fixtures/podcastEpisode";

function image(type: ImageType, path: string) {
  return { type, path, provider: "builtin", remotely_accessible: true };
}

describe("podcastEpisodeData", () => {
  describe("podcastEpisodeBackdrop", () => {
    it("paints wide art of the episode as it is", () => {
      const episode = podcastEpisode({
        metadata: { images: [image(ImageType.LANDSCAPE, "episode.jpg")] },
      });
      const show = podcast({
        metadata: { images: [image(ImageType.FANART, "podcast.jpg")] },
      });

      const backdrop = podcastEpisodeBackdrop(episode, show);

      expect(backdrop.url).toContain("episode.jpg");
      expect(backdrop.blurred).toBe(false);
    });

    it("falls back to the podcast's wide art", () => {
      const episode = podcastEpisode({
        metadata: { images: [image(ImageType.THUMB, "cover.jpg")] },
      });
      const show = podcast({
        metadata: { images: [image(ImageType.FANART, "podcast.jpg")] },
      });

      const backdrop = podcastEpisodeBackdrop(episode, show);

      expect(backdrop.url).toContain("podcast.jpg");
      expect(backdrop.blurred).toBe(false);
    });

    it("blurs the episode cover when nothing wide is to be had", () => {
      const episode = podcastEpisode({
        metadata: { images: [image(ImageType.THUMB, "cover.jpg")] },
      });

      const backdrop = podcastEpisodeBackdrop(episode, podcast());

      expect(backdrop.url).toContain("cover.jpg");
      expect(backdrop.blurred).toBe(true);
    });

    it("has no artwork to paint when neither has any", () => {
      const backdrop = podcastEpisodeBackdrop(podcastEpisode());

      expect(backdrop).toEqual({ url: undefined, blurred: true });
    });
  });
});
