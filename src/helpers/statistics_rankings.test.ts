import { describe, expect, it } from "vitest";
import {
  MediaType,
  type ItemMapping,
  type StatisticsListeningTimeItem,
} from "@/plugins/api/interfaces";
import {
  findListeningTime,
  sharePercent,
  shareSegments,
  sortDecades,
  topEntry,
} from "./statistics_rankings";

describe("sharePercent", () => {
  it("rounds to a whole percentage", () => {
    expect(sharePercent(1, 3)).toBe(33);
    expect(sharePercent(2, 3)).toBe(67);
    expect(sharePercent(5, 5)).toBe(100);
  });

  it("stays between 0 and 100", () => {
    expect(sharePercent(0, 10)).toBe(0);
    expect(sharePercent(3, 0)).toBe(0);
    expect(sharePercent(-1, 10)).toBe(0);
    expect(sharePercent(12, 10)).toBe(100);
    expect(sharePercent(Number.NaN, 10)).toBe(0);
  });
});

describe("shareSegments", () => {
  it("names the first entries and sums the rest as other", () => {
    const segments = shareSegments(
      [
        { name: "Techno", value: 41 },
        { name: "Trance", value: 18 },
        { name: "House", value: 14 },
        { name: "Indie", value: 11 },
        { name: "Pop", value: 10 },
        { name: "Jazz", value: 6 },
      ],
      4,
    );

    expect(segments.map((segment) => segment.share)).toEqual([
      41, 18, 14, 11, 16,
    ]);
    expect(segments[4]).toEqual({
      name: "",
      value: 16,
      share: 16,
      isOther: true,
    });
  });

  it("has no other segment when every entry is named", () => {
    const segments = shareSegments([
      { name: "Techno", value: 3 },
      { name: "House", value: 1 },
    ]);

    expect(segments).toEqual([
      { name: "Techno", value: 3, share: 75, isOther: false },
      { name: "House", value: 1, share: 25, isOther: false },
    ]);
  });

  it("leaves out entries without plays", () => {
    expect(shareSegments([{ name: "Techno", value: 0 }])).toEqual([]);
    expect(shareSegments([])).toEqual([]);
  });
});

describe("topEntry", () => {
  it("returns the entry with the most plays, the first on a tie", () => {
    expect(
      topEntry([
        { name: "1990s", value: 2 },
        { name: "2020s", value: 9 },
        { name: "2010s", value: 9 },
      ]),
    ).toEqual({ name: "2020s", value: 9 });
  });

  it("is undefined without plays", () => {
    expect(topEntry([])).toBeUndefined();
    expect(topEntry([{ name: "1990s", value: 0 }])).toBeUndefined();
  });
});

describe("sortDecades", () => {
  it("orders decades oldest first without changing the input", () => {
    const input = [
      { name: "2020s", value: 1 },
      { name: "1980s", value: 2 },
      { name: "2000s", value: 3 },
    ];

    expect(sortDecades(input).map((decade) => decade.name)).toEqual([
      "1980s",
      "2000s",
      "2020s",
    ]);
    expect(input[0].name).toBe("2020s");
  });
});

describe("findListeningTime", () => {
  const artist = (item_id: string, provider = "library"): ItemMapping => ({
    item_id,
    provider,
    media_type: MediaType.ARTIST,
    name: "Royal Blood",
    uri: `${provider}://artist/${item_id}`,
    version: "",
    external_ids: [],
    available: true,
    is_playable: true,
  });

  it("matches the artist by provider and id, not by name", () => {
    const entries: StatisticsListeningTimeItem[] = [
      { name: "Royal Blood", minutes: 12, item: artist("1") },
      { name: "Royal Blood", minutes: 30, item: artist("2") },
    ];

    expect(findListeningTime(artist("2"), entries)).toBe(entries[1]);
  });

  it("is undefined when no entry has that artist", () => {
    const entries: StatisticsListeningTimeItem[] = [
      { name: "Royal Blood", minutes: 12, item: artist("1", "spotify") },
      { name: "Rock", minutes: 40, item: null },
    ];

    expect(findListeningTime(artist("1"), entries)).toBeUndefined();
  });
});
