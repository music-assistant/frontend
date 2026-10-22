import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRACK_COLUMNS,
  isHiddenAtWidth,
  OPTIONAL_TRACK_COLUMNS,
  trackTableGridTemplate,
  visibleTrackColumns,
} from "./trackTableColumns";

describe("visibleTrackColumns", () => {
  it("always shows title, duration and the menu", () => {
    expect(visibleTrackColumns([], 2000)).toEqual([
      "title",
      "favorite",
      "duration",
      "menu",
    ]);
    expect(visibleTrackColumns(OPTIONAL_TRACK_COLUMNS, 320)).toEqual([
      "title",
      "duration",
      "menu",
    ]);
  });

  it("shows every column on a wide table, in order", () => {
    expect(visibleTrackColumns(OPTIONAL_TRACK_COLUMNS, 1400)).toEqual([
      "number",
      "title",
      "album",
      "year",
      "bpm",
      "key",
      "favorite",
      "duration",
      "menu",
    ]);
  });

  it("starts with BPM and key switched off", () => {
    const columns = visibleTrackColumns(DEFAULT_TRACK_COLUMNS, 1400);
    expect(columns).not.toContain("bpm");
    expect(columns).not.toContain("key");
    expect(columns).toContain("year");
  });

  it("drops columns by priority as the table narrows", () => {
    const at = (width: number) =>
      visibleTrackColumns(OPTIONAL_TRACK_COLUMNS, width);
    expect(at(1100)).toContain("year");
    expect(at(1099)).not.toContain("year");
    expect(at(1099)).toEqual(expect.arrayContaining(["bpm", "key"]));
    expect(at(999)).not.toContain("bpm");
    expect(at(600)).toEqual(
      expect.arrayContaining(["number", "album", "favorite", "title"]),
    );
    expect(at(599)).toEqual(["title", "duration", "menu"]);
  });

  it("adds a play column before the menu on touch devices", () => {
    expect(visibleTrackColumns([], 320, true)).toEqual([
      "title",
      "duration",
      "play",
      "menu",
    ]);
  });

  it("keeps a column the user switched off hidden, even with room", () => {
    const columns = visibleTrackColumns(["number", "year"], 1600);
    expect(columns).not.toContain("album");
    expect(columns).not.toContain("bpm");
    expect(columns).toContain("year");
  });
});

describe("isHiddenAtWidth", () => {
  it("never hides the columns that are always shown", () => {
    expect(isHiddenAtWidth("title", 0)).toBe(false);
    expect(isHiddenAtWidth("duration", 0)).toBe(false);
  });

  it("hides a column below its width", () => {
    expect(isHiddenAtWidth("year", 1000)).toBe(true);
    expect(isHiddenAtWidth("year", 1100)).toBe(false);
  });
});

describe("trackTableGridTemplate", () => {
  it("has one track per column", () => {
    expect(trackTableGridTemplate(["title", "duration", "menu"])).toBe(
      "minmax(0,4fr) 3.5rem 2.5rem",
    );
  });
});
