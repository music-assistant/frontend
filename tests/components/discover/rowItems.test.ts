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
  it("only fetches shown rows", () => {
    expect(rowIdsNeedingItems(rows)).toEqual(["a", "c"]);
  });

  it("never fetches hidden rows, even the heavy default-off ones", () => {
    const allHidden = rows.map((r) => ({ ...r, hidden: true }));
    expect(rowIdsNeedingItems(allHidden)).toEqual([]);
  });

  it("fetches a previously hidden row once it is toggled shown", () => {
    const toggled = rows.map((r) =>
      r.id === "b" ? { ...r, hidden: false } : r,
    );
    expect(rowIdsNeedingItems(toggled)).toEqual(["a", "b", "c"]);
  });
});

describe("isRecommendationRowVisible", () => {
  it("shows a hidden row in edit mode regardless of its items", () => {
    const row = { id: "b", hidden: true };
    expect(isRecommendationRowVisible(row, undefined, true, false)).toBe(true);
    expect(isRecommendationRowVisible(row, [], true, false)).toBe(true);
    expect(isRecommendationRowVisible(row, [1], true, false)).toBe(true);
  });

  it("never shows a hidden row in normal mode, even with an active filter", () => {
    const row = { id: "b", hidden: true };
    expect(isRecommendationRowVisible(row, [1, 2], false, false)).toBe(false);
    expect(isRecommendationRowVisible(row, [], false, true)).toBe(false);
  });

  it("shows a shown row while its items are still loading", () => {
    const row = { id: "a", hidden: false };
    expect(isRecommendationRowVisible(row, undefined, false, false)).toBe(true);
  });

  it("hides a shown row once its items resolve to empty, in normal mode only", () => {
    const row = { id: "a", hidden: false };
    expect(isRecommendationRowVisible(row, [], false, false)).toBe(false);
    expect(isRecommendationRowVisible(row, [], true, false)).toBe(true);
  });

  it("shows a shown row once its items resolve to non-empty", () => {
    const row = { id: "a", hidden: false };
    expect(isRecommendationRowVisible(row, [1], false, false)).toBe(true);
  });

  it("keeps a shown row with an active filter visible even if it resolves to no items", () => {
    const row = { id: "a", hidden: false };
    expect(isRecommendationRowVisible(row, [], false, true)).toBe(true);
  });
});
