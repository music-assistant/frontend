import { describe, expect, it, vi } from "vitest";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    serverInfo: { value: null },
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock }));
// the numbering is built from placeholders, so the args have to come through with it
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, args?: unknown[]) =>
    args ? `${key}(${args.join(",")})` : key,
}));

import {
  episodeReleaseDate,
  podcastEpisodeNumber,
} from "@/components/podcast/podcastEpisodeData";
import { ImageType } from "@/plugins/api/interfaces";
import { podcast } from "../../fixtures/podcast";
import { podcastEpisode } from "../../fixtures/podcastEpisode";

function image(type: ImageType, path: string) {
  return { type, path, provider: "builtin", remotely_accessible: true };
}

describe("podcastEpisodeData", () => {
  describe("podcastEpisodeNumber", () => {
    it("gives the season and episode number", () => {
      const number = podcastEpisodeNumber(
        podcastEpisode({ season: 1, episode_number: 53 }),
      );

      expect(number).toEqual({
        short: "season_episode_number_short(1,53)",
        label: "season_episode_number(1,53)",
      });
    });

    it("gives only the episode number without a season", () => {
      const number = podcastEpisodeNumber(
        podcastEpisode({ episode_number: 53 }),
      );

      expect(number).toEqual({
        short: "episode_number_short(53)",
        label: "episode_number(53)",
      });
    });

    // a season alone says little about where the episode sits
    it("gives nothing without an episode number", () => {
      expect(podcastEpisodeNumber(podcastEpisode({ season: 2 }))).toBe(
        undefined,
      );
    });
  });

  describe("episodeReleaseDate", () => {
    it.each([
      [undefined, ""],
      ["not a date", ""],
      [
        "2026-10-22T08:00:00Z",
        new Date("2026-10-22T08:00:00Z").toLocaleDateString(undefined, {
          dateStyle: "medium",
        }),
      ],
    ])("shows %s as %j", (release_date, expected) => {
      const episode = podcastEpisode({ metadata: { release_date } });
      expect(episodeReleaseDate(episode)).toBe(expected);
    });
  });
});
