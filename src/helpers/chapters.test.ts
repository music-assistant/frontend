import { describe, it, expect } from "vitest";
import { computeChapterTicks } from "./chapters";
import type { MediaItemChapter } from "@/plugins/api/interfaces";

const chapters: MediaItemChapter[] = [
  { position: 1, name: "Intro", start: 0 },
  { position: 2, name: "Middle", start: 60 },
  { position: 3, name: "End", start: 120 },
];

describe("computeChapterTicks", () => {
  it("returns [] when duration is missing or zero", () => {
    expect(computeChapterTicks(chapters, undefined)).toEqual([]);
    expect(computeChapterTicks(chapters, 0)).toEqual([]);
  });

  it("returns [] when there are no chapters", () => {
    expect(computeChapterTicks(undefined, 120)).toEqual([]);
    expect(computeChapterTicks([], 120)).toEqual([]);
  });

  it("computes each chapter's start as a percentage of the duration", () => {
    const ticks = computeChapterTicks(chapters, 120);
    expect(ticks.map((t) => t.percent)).toEqual([0, 50, 100]);
  });

  it("preserves the original chapter fields", () => {
    const [first] = computeChapterTicks(chapters, 120);
    expect(first).toMatchObject({ position: 1, name: "Intro", start: 0 });
  });

  it("clamps out-of-range chapters to [0, 100]", () => {
    const stray: MediaItemChapter[] = [
      { position: 1, name: "before start", start: -30 },
      { position: 2, name: "past end", start: 240 },
    ];
    expect(computeChapterTicks(stray, 120).map((t) => t.percent)).toEqual([
      0, 100,
    ]);
  });
});
