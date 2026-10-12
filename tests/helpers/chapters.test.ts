import { describe, it, expect } from "vitest";
import { computeChapterTicks, resolveCurrentChapter } from "@/helpers/chapters";
import type { MediaItemChapter } from "@/plugins/api/interfaces";

const chapters: MediaItemChapter[] = [
  { position: 1, name: "Intro", start: 0, end: null },
  { position: 2, name: "Middle", start: 60, end: null },
  { position: 3, name: "End", start: 120, end: null },
];

describe("resolveCurrentChapter", () => {
  const audiobookChapters: MediaItemChapter[] = [
    { position: 1, name: "Intro", start: 0, end: 60 },
    { position: 2, name: "Middle", start: 60, end: 120 },
    { position: 3, name: "End", start: 120, end: null },
  ];

  it("resolves chapter ranges as half-open intervals", () => {
    expect(resolveCurrentChapter(audiobookChapters, 0, 180)?.chapter.name).toBe(
      "Intro",
    );
    expect(
      resolveCurrentChapter(audiobookChapters, 60, 180)?.chapter.name,
    ).toBe("Middle");
  });

  it("uses media duration for the final open-ended chapter", () => {
    expect(resolveCurrentChapter(audiobookChapters, 150, 180)).toMatchObject({
      start: 120,
      end: 180,
      duration: 60,
    });
  });

  it("keeps an open-ended final chapter active without media duration", () => {
    expect(resolveCurrentChapter(audiobookChapters, 150, null)).toMatchObject({
      start: 120,
      end: Number.POSITIVE_INFINITY,
    });
  });

  it("keeps the final chapter active at exact media completion", () => {
    expect(resolveCurrentChapter(audiobookChapters, 180, 180)).toMatchObject({
      chapter: audiobookChapters[2],
      start: 120,
      end: 180,
      duration: 60,
    });
  });

  it("returns undefined outside the chapter ranges", () => {
    expect(resolveCurrentChapter(audiobookChapters, -1, 180)).toBeUndefined();
    expect(
      resolveCurrentChapter(audiobookChapters, undefined, 180),
    ).toBeUndefined();
  });

  it("resolves chapters by start time when metadata is unsorted", () => {
    const unsorted = [
      audiobookChapters[2],
      audiobookChapters[0],
      audiobookChapters[1],
    ];
    expect(resolveCurrentChapter(unsorted, 75, 180)?.chapter.name).toBe(
      "Middle",
    );
  });
});

describe("computeChapterTicks", () => {
  it("returns [] when duration is missing or zero", () => {
    expect(computeChapterTicks(chapters, null)).toEqual([]);
    expect(computeChapterTicks(chapters, undefined)).toEqual([]);
    expect(computeChapterTicks(chapters, 0)).toEqual([]);
  });

  it("returns [] when there are no chapters", () => {
    expect(computeChapterTicks(null, 120)).toEqual([]);
    expect(computeChapterTicks(undefined, 120)).toEqual([]);
    expect(computeChapterTicks([], 120)).toEqual([]);
  });

  it("computes each chapter's start as a percentage of the duration", () => {
    const ticks = computeChapterTicks(chapters, 120);
    expect(ticks.map((t) => t.percent)).toEqual([0, 50, 100]);
  });

  it("preserves the original chapter fields", () => {
    const [first] = computeChapterTicks(chapters, 120);
    expect(first).toMatchObject({
      position: 1,
      name: "Intro",
      start: 0,
      end: null,
    });
  });

  it("clamps out-of-range chapters to [0, 100]", () => {
    const stray: MediaItemChapter[] = [
      { position: 1, name: "before start", start: -30, end: null },
      { position: 2, name: "past end", start: 240, end: null },
    ];
    expect(computeChapterTicks(stray, 120).map((t) => t.percent)).toEqual([
      0, 100,
    ]);
  });
});
