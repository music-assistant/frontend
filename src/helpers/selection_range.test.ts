import { describe, expect, it } from "vitest";
import { selectionRange } from "./selection_range";

const items = ["a", "b", "c", "d", "e"];

describe("selectionRange", () => {
  it("spans from the anchor down to the target", () => {
    expect(selectionRange(items, "b", "d")).toEqual(["b", "c", "d"]);
  });

  it("spans from the anchor up to the target", () => {
    expect(selectionRange(items, "d", "a")).toEqual(["a", "b", "c", "d"]);
  });

  it("is only the target without an anchor", () => {
    expect(selectionRange(items, undefined, "c")).toEqual(["c"]);
  });

  it("is only the target when the anchor left the listing", () => {
    expect(selectionRange(items, "z", "c")).toEqual(["c"]);
  });
});
