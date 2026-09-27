import { describe, expect, it } from "vitest";
import {
  GRID_SIZE_DEFAULT,
  GRID_SIZE_MAX,
  GRID_SIZE_MIN,
  gridColumns,
  normalizeGridSize,
} from "./grid_size";

describe("gridColumns", () => {
  it("keeps the responsive column count at the default size", () => {
    expect(gridColumns(5, GRID_SIZE_DEFAULT)).toBe(5);
  });

  it("uses fewer columns for larger covers and more for smaller", () => {
    expect(gridColumns(5, 1)).toBe(4);
    expect(gridColumns(5, -2)).toBe(7);
  });

  it("never goes below two columns", () => {
    expect(gridColumns(2, GRID_SIZE_MAX)).toBe(2);
    expect(gridColumns(3, GRID_SIZE_MAX)).toBe(2);
  });

  it("reaches up to twelve columns at the smallest size", () => {
    expect(GRID_SIZE_MIN).toBe(-4);
    expect(gridColumns(6, GRID_SIZE_MIN)).toBe(10);
    expect(gridColumns(8, GRID_SIZE_MIN)).toBe(12);
  });

  it("never goes above twelve columns", () => {
    expect(gridColumns(9, GRID_SIZE_MIN)).toBe(12);
  });
});

describe("normalizeGridSize", () => {
  it("falls back to the default for anything that is not a number", () => {
    expect(normalizeGridSize(undefined)).toBe(GRID_SIZE_DEFAULT);
    expect(normalizeGridSize("big")).toBe(GRID_SIZE_DEFAULT);
    expect(normalizeGridSize(Number.NaN)).toBe(GRID_SIZE_DEFAULT);
  });

  it("clamps and rounds stored values into the slider's range", () => {
    expect(normalizeGridSize(10)).toBe(GRID_SIZE_MAX);
    expect(normalizeGridSize(-10)).toBe(GRID_SIZE_MIN);
    expect(normalizeGridSize(1.4)).toBe(1);
  });
});
