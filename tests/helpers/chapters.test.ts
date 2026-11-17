import { describe, it, expect } from "vitest";
import {
  computeChapterSegments,
  groupBookmarksByChapter,
  resolveCurrentChapter,
} from "@/helpers/chapters";
import type {
  MediaItemBookmark,
  MediaItemChapter,
} from "@/plugins/api/interfaces";

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

describe("computeChapterSegments", () => {
  it("has no segments without a duration or chapters", () => {
    expect(computeChapterSegments(chapters, 0)).toEqual([]);
    expect(computeChapterSegments([], 120)).toEqual([]);
  });

  it("runs each chapter to the next one's start", () => {
    const segments = computeChapterSegments(chapters, 240);
    expect(
      segments.map((x) => [x.chapter?.name, x.startPercent, x.widthPercent]),
    ).toEqual([
      ["Intro", 0, 25],
      ["Middle", 25, 25],
      ["End", 50, 50],
    ]);
  });

  it("covers the start before the first chapter and skips chapters past the end", () => {
    const late: MediaItemChapter[] = [
      { position: 2, name: "Second", start: 90, end: null },
      { position: 1, name: "First", start: 30, end: null },
      { position: 3, name: "past end", start: 240, end: null },
    ];
    expect(
      computeChapterSegments(late, 120).map((x) => [
        x.chapter?.name,
        x.start,
        x.end,
      ]),
    ).toEqual([
      [undefined, 0, 30],
      ["First", 30, 90],
      ["Second", 90, 120],
    ]);
  });
});

describe("groupBookmarksByChapter", () => {
  const bookmark = (start: number): MediaItemBookmark => ({
    name: `at ${start}`,
    start,
    provider_instance: "abs--1",
    item_id: "book1",
    stored_by_music_assistant: false,
  });

  // the first chapter takes what lies before it, the last what lies past it
  it.each([
    [
      chapters,
      [
        ["Intro", [-5, 0, 59]],
        ["Middle", [60]],
        ["End", [120, 500]],
      ],
    ],
    [[], [[undefined, [-5, 0, 59, 60, 120, 500]]]],
  ])("places each bookmark in its chapter", (bookChapters, expected) => {
    const groups = groupBookmarksByChapter(
      bookChapters,
      [500, 60, 0, 120, 59, -5].map(bookmark),
    );
    expect(
      groups.map((x) => [x.chapter?.name, x.bookmarks.map((b) => b.start)]),
    ).toEqual(expected);
  });

  it("lists the chapters in playing order", () => {
    const groups = groupBookmarksByChapter(
      [chapters[2], chapters[0], chapters[1]],
      [70].map(bookmark),
    );
    expect(
      groups.map((x) => [x.chapter?.name, x.bookmarks.map((b) => b.start)]),
    ).toEqual([
      ["Intro", []],
      ["Middle", [70]],
      ["End", []],
    ]);
  });

  // e.g. the chapters of another copy of the book
  it("lists the bookmarks apart from chapters that do not fit them", () => {
    const groups = groupBookmarksByChapter(
      chapters,
      [60, 0].map(bookmark),
      false,
    );
    expect(
      groups.map((x) => [x.chapter?.name, x.bookmarks.map((b) => b.start)]),
    ).toEqual([
      ["Intro", []],
      ["Middle", []],
      ["End", []],
      [undefined, [0, 60]],
    ]);
  });

  it("has nothing to show for a book without chapters or bookmarks", () => {
    expect(groupBookmarksByChapter(null, [])).toEqual([]);
  });
});
