import { describe, it, expect, afterEach } from "vitest";
import {
  buildLatestEpisodes,
  dedupeEpisodes,
  formatEpisodeReleaseDate,
  getEpisodeReleaseTime,
  sortEpisodesByReleaseDate,
  takeNewestCandidates,
  DEFAULT_CANDIDATES_PER_PODCAST,
  MAX_LATEST_EPISODES,
} from "./podcast_latest";
import type { PodcastEpisode } from "@/plugins/api/interfaces";

interface EpisodeOverrides {
  uri?: string;
  itemId?: string;
  provider?: string;
  releaseDate?: string;
}

/**
 * Build a minimal PodcastEpisode fixture. Only the fields exercised by the
 * pure transforms are populated; the rest are cast to satisfy the type.
 */
function makeEpisode(name: string, overrides: EpisodeOverrides = {}) {
  const itemId = overrides.itemId ?? name;
  const provider = overrides.provider ?? "test";
  return {
    item_id: itemId,
    provider,
    name,
    uri: overrides.uri ?? `podcast_episode://${provider}/${itemId}`,
    is_playable: true,
    metadata: overrides.releaseDate
      ? { release_date: overrides.releaseDate }
      : {},
    provider_mappings: [],
    favorite: false,
    position: 0,
    duration: 0,
    podcast: { name: "Parent" },
    timestamp_added: 0,
    timestamp_modified: 0,
  } as unknown as PodcastEpisode;
}

describe("getEpisodeReleaseTime", () => {
  it("returns null when release_date is missing", () => {
    expect(getEpisodeReleaseTime(makeEpisode("a"))).toBeNull();
  });

  it("returns null for an unparseable date", () => {
    expect(
      getEpisodeReleaseTime(makeEpisode("a", { releaseDate: "not-a-date" })),
    ).toBeNull();
  });

  it("parses a valid ISO date to a timestamp", () => {
    expect(
      getEpisodeReleaseTime(makeEpisode("a", { releaseDate: "2024-01-01" })),
    ).toBe(new Date("2024-01-01").getTime());
  });

  it("pins a valid date-only value to UTC midnight", () => {
    expect(
      getEpisodeReleaseTime(makeEpisode("a", { releaseDate: "2024-02-28" })),
    ).toBe(Date.UTC(2024, 1, 28));
  });

  it("returns null for an impossible-but-in-range date-only value", () => {
    // "2024-02-31" is date-only-shaped and in range per-field, but Feb has no
    // 31st. It must sort as undated rather than being normalized to March.
    expect(
      getEpisodeReleaseTime(makeEpisode("a", { releaseDate: "2024-02-31" })),
    ).toBeNull();
  });

  it("keeps instant semantics for a full ISO timestamp", () => {
    expect(
      getEpisodeReleaseTime(
        makeEpisode("a", { releaseDate: "2024-01-15T05:00:00Z" }),
      ),
    ).toBe(new Date("2024-01-15T05:00:00Z").getTime());
  });
});

describe("formatEpisodeReleaseDate", () => {
  it("returns null when the episode has no valid release date", () => {
    expect(formatEpisodeReleaseDate(makeEpisode("a"))).toBeNull();
    expect(
      formatEpisodeReleaseDate(makeEpisode("a", { releaseDate: "nope" })),
    ).toBeNull();
  });

  it("returns a non-empty localized string for a valid date", () => {
    const formatted = formatEpisodeReleaseDate(
      makeEpisode("a", { releaseDate: "2024-01-15" }),
      "en-US",
    );
    expect(formatted).toBeTruthy();
    expect(formatted).toContain("2024");
  });

  // Music Assistant locale keys use underscores (en_GB, pt_BR, zh_CN) which
  // are not valid BCP-47 tags. They must be canonicalized so Intl formatting
  // never throws, and must render identically to their hyphenated form.
  it.each(["en_GB", "pt_BR", "zh_CN"])(
    "formats a date-only value with underscore locale %s without throwing",
    (underscoreLocale) => {
      const hyphenLocale = underscoreLocale.replace("_", "-");
      const episode = makeEpisode("a", { releaseDate: "2024-01-15" });
      let formatted: string | null = null;
      expect(() => {
        formatted = formatEpisodeReleaseDate(episode, underscoreLocale);
      }).not.toThrow();
      expect(formatted).toBeTruthy();
      expect(formatted).toBe(formatEpisodeReleaseDate(episode, hyphenLocale));
    },
  );

  it.each(["en_GB", "pt_BR", "zh_CN"])(
    "formats a full ISO timestamp with underscore locale %s without throwing",
    (underscoreLocale) => {
      const hyphenLocale = underscoreLocale.replace("_", "-");
      const episode = makeEpisode("a", {
        releaseDate: "2024-01-15T05:00:00Z",
      });
      let formatted: string | null = null;
      expect(() => {
        formatted = formatEpisodeReleaseDate(episode, underscoreLocale);
      }).not.toThrow();
      expect(formatted).toBeTruthy();
      expect(formatted).toBe(formatEpisodeReleaseDate(episode, hyphenLocale));
    },
  );
});

describe("formatEpisodeReleaseDate in a western time zone", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    // Restore any mutated TZ state so other tests are unaffected.
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  it("renders a date-only value as its local calendar date west of UTC", () => {
    process.env.TZ = "America/Los_Angeles";
    // Naive `new Date("2024-01-15")` is UTC midnight, which is Jan 14 in LA;
    // the date-only path must keep it on Jan 15.
    expect(
      formatEpisodeReleaseDate(
        makeEpisode("a", { releaseDate: "2024-01-15" }),
        "en-US",
      ),
    ).toBe("Jan 15, 2024");
  });

  it("keeps instant semantics for a full ISO timestamp west of UTC", () => {
    process.env.TZ = "America/Los_Angeles";
    // 2024-01-15T05:00:00Z is 2024-01-14 21:00 in LA, so it renders as Jan 14.
    expect(
      formatEpisodeReleaseDate(
        makeEpisode("a", { releaseDate: "2024-01-15T05:00:00Z" }),
        "en-US",
      ),
    ).toBe("Jan 14, 2024");
  });

  it("does not treat an out-of-range date-only value as a local calendar date", () => {
    process.env.TZ = "America/Los_Angeles";
    // "2024-13-40" matches the YYYY-MM-DD shape but is not a real date, so the
    // strict date-only path returns null rather than a bogus local date.
    expect(
      formatEpisodeReleaseDate(makeEpisode("a", { releaseDate: "2024-13-40" })),
    ).toBeNull();
  });

  it("returns null for an impossible-but-in-range date-only value", () => {
    process.env.TZ = "America/Los_Angeles";
    // "2024-02-31" is date-only-shaped and in range per-field, but Feb has no
    // 31st. It must NOT fall through to generic Date parsing (which would
    // normalize it to March 2); the strict path returns null instead.
    expect(
      formatEpisodeReleaseDate(makeEpisode("a", { releaseDate: "2024-02-31" })),
    ).toBeNull();
  });
});

describe("sortEpisodesByReleaseDate", () => {
  it("orders dated episodes newest-first", () => {
    const episodes = [
      makeEpisode("old", { releaseDate: "2020-01-01" }),
      makeEpisode("new", { releaseDate: "2024-06-01" }),
      makeEpisode("mid", { releaseDate: "2022-03-01" }),
    ];
    expect(sortEpisodesByReleaseDate(episodes).map((e) => e.name)).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  it("places undated episodes after dated ones, preserving input order", () => {
    const episodes = [
      makeEpisode("undated-a"),
      makeEpisode("dated-old", { releaseDate: "2020-01-01" }),
      makeEpisode("undated-b"),
      makeEpisode("dated-new", { releaseDate: "2024-01-01" }),
    ];
    expect(sortEpisodesByReleaseDate(episodes).map((e) => e.name)).toEqual([
      "dated-new",
      "dated-old",
      "undated-a",
      "undated-b",
    ]);
  });

  it("does not mutate the input array", () => {
    const episodes = [
      makeEpisode("a", { releaseDate: "2020-01-01" }),
      makeEpisode("b", { releaseDate: "2024-01-01" }),
    ];
    const snapshot = episodes.map((e) => e.name);
    sortEpisodesByReleaseDate(episodes);
    expect(episodes.map((e) => e.name)).toEqual(snapshot);
  });

  it("orders valid date-only values deterministically newest-first", () => {
    const episodes = [
      makeEpisode("feb", { releaseDate: "2024-02-28" }),
      makeEpisode("mar", { releaseDate: "2024-03-01" }),
      makeEpisode("jan", { releaseDate: "2024-01-15" }),
    ];
    expect(sortEpisodesByReleaseDate(episodes).map((e) => e.name)).toEqual([
      "mar",
      "feb",
      "jan",
    ]);
  });

  it("treats impossible date-only values as undated and sorts them last", () => {
    const episodes = [
      makeEpisode("impossible", { releaseDate: "2024-02-31" }),
      makeEpisode("dated", { releaseDate: "2020-01-01" }),
    ];
    expect(sortEpisodesByReleaseDate(episodes).map((e) => e.name)).toEqual([
      "dated",
      "impossible",
    ]);
  });
});

describe("dedupeEpisodes", () => {
  it("removes duplicates by uri, keeping the first occurrence", () => {
    const episodes = [
      makeEpisode("first", { uri: "podcast_episode://x/1" }),
      makeEpisode("duplicate", { uri: "podcast_episode://x/1" }),
      makeEpisode("second", { uri: "podcast_episode://x/2" }),
    ];
    expect(dedupeEpisodes(episodes).map((e) => e.name)).toEqual([
      "first",
      "second",
    ]);
  });

  it("falls back to provider + item id when uri is empty", () => {
    const episodes = [
      makeEpisode("a", { uri: "", provider: "p", itemId: "1" }),
      makeEpisode("a-dup", { uri: "", provider: "p", itemId: "1" }),
      makeEpisode("b", { uri: "", provider: "p", itemId: "2" }),
    ];
    expect(dedupeEpisodes(episodes).map((e) => e.name)).toEqual(["a", "b"]);
  });
});

describe("takeNewestCandidates", () => {
  it("takes the newest N episodes from a feed", () => {
    const episodes = [
      makeEpisode("e1", { releaseDate: "2020-01-01" }),
      makeEpisode("e2", { releaseDate: "2021-01-01" }),
      makeEpisode("e3", { releaseDate: "2022-01-01" }),
      makeEpisode("e4", { releaseDate: "2023-01-01" }),
    ];
    expect(takeNewestCandidates(episodes, 2).map((e) => e.name)).toEqual([
      "e4",
      "e3",
    ]);
  });

  it("returns an empty array when the limit is zero or negative", () => {
    const episodes = [makeEpisode("e1", { releaseDate: "2020-01-01" })];
    expect(takeNewestCandidates(episodes, 0)).toEqual([]);
    expect(takeNewestCandidates(episodes, -5)).toEqual([]);
  });

  it("defaults to DEFAULT_CANDIDATES_PER_PODCAST", () => {
    const episodes = Array.from({ length: 25 }, (_, index) =>
      makeEpisode(`e${index}`, {
        releaseDate: `2024-01-${String(index + 1).padStart(2, "0")}`,
      }),
    );
    expect(takeNewestCandidates(episodes)).toHaveLength(
      DEFAULT_CANDIDATES_PER_PODCAST,
    );
  });
});

describe("buildLatestEpisodes", () => {
  it("merges feeds, sorts globally by release date and caps candidates per podcast", () => {
    const podcastA = [
      makeEpisode("A-new", { uri: "a-new", releaseDate: "2024-05-01" }),
      makeEpisode("A-old", { uri: "a-old", releaseDate: "2020-01-01" }),
    ];
    const podcastB = [
      makeEpisode("B-newest", { uri: "b-newest", releaseDate: "2024-09-01" }),
    ];
    const result = buildLatestEpisodes([podcastA, podcastB], {
      candidatesPerPodcast: 1,
    });
    // Only the single newest of each feed survives the per-podcast cap, then
    // they are globally sorted newest-first.
    expect(result.map((e) => e.name)).toEqual(["B-newest", "A-new"]);
  });

  it("deduplicates episodes that appear in multiple feeds", () => {
    const shared = { uri: "shared-uri", releaseDate: "2024-01-01" };
    const feedOne = [makeEpisode("shared-one", shared)];
    const feedTwo = [makeEpisode("shared-two", shared)];
    const result = buildLatestEpisodes([feedOne, feedTwo]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("shared-one");
  });

  it("keeps undated episodes after dated ones while preserving provider order", () => {
    const feedOne = [makeEpisode("p1-undated", { uri: "p1" })];
    const feedTwo = [makeEpisode("p2-undated", { uri: "p2" })];
    const feedThree = [
      makeEpisode("p3-dated", { uri: "p3", releaseDate: "2024-01-01" }),
    ];
    const result = buildLatestEpisodes([feedOne, feedTwo, feedThree]);
    expect(result.map((e) => e.name)).toEqual([
      "p3-dated",
      "p1-undated",
      "p2-undated",
    ]);
  });

  it("caps the combined listing at maxResults", () => {
    const feeds = Array.from({ length: 200 }, (_, index) => [
      makeEpisode(`e${index}`, {
        uri: `uri-${index}`,
        releaseDate: `2024-01-01T00:00:${String(index % 60).padStart(2, "0")}`,
      }),
    ]);
    const result = buildLatestEpisodes(feeds, { candidatesPerPodcast: 1 });
    expect(result).toHaveLength(MAX_LATEST_EPISODES);
  });

  it("returns an empty array when there are no feeds", () => {
    expect(buildLatestEpisodes([])).toEqual([]);
  });
});
