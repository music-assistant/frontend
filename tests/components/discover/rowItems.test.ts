import { describe, expect, it } from "vitest";
import {
  isRecommendationRowVisible,
  rowIdsNeedingItems,
  type RecommendationRowState,
} from "@/components/discover/utils/rowItems";

const rows: RecommendationRowState[] = [
  { id: "a", hidden: false },
  { id: "b", hidden: true },
  { id: "c", hidden: false },
];

describe("rowIdsNeedingItems", () => {
  it("only fetches shown rows in normal mode", () => {
    expect(rowIdsNeedingItems(rows, false)).toEqual(["a", "c"]);
  });

  it("fetches every row (including hidden ones) in edit mode", () => {
    expect(rowIdsNeedingItems(rows, true)).toEqual(["a", "b", "c"]);
  });

  it("fetches a previously hidden row once it is toggled shown", () => {
    const toggled = rows.map((r) =>
      r.id === "b" ? { ...r, hidden: false } : r,
    );
    expect(rowIdsNeedingItems(toggled, false)).toEqual(["a", "b", "c"]);
  });
});

describe("isRecommendationRowVisible", () => {
  it("shows a hidden row in edit mode regardless of its items", () => {
    const row = { id: "b", hidden: true };
    expect(isRecommendationRowVisible(row, undefined, true)).toBe(true);
    expect(isRecommendationRowVisible(row, [], true)).toBe(true);
    expect(isRecommendationRowVisible(row, [1], true)).toBe(true);
  });

  it("never shows a hidden row in normal mode", () => {
    const row = { id: "b", hidden: true };
    expect(isRecommendationRowVisible(row, [1, 2], false)).toBe(false);
  });

  it("shows a shown row while its items are still loading", () => {
    const row = { id: "a", hidden: false };
    expect(isRecommendationRowVisible(row, undefined, false)).toBe(true);
  });

  it("hides a shown row once its items resolve to empty, in normal mode only", () => {
    const row = { id: "a", hidden: false };
    expect(isRecommendationRowVisible(row, [], false)).toBe(false);
    expect(isRecommendationRowVisible(row, [], true)).toBe(true);
  });

  it("shows a shown row once its items resolve to non-empty", () => {
    const row = { id: "a", hidden: false };
    expect(isRecommendationRowVisible(row, [1], false)).toBe(true);
  });
});
