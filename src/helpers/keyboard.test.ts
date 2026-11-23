import { describe, expect, it } from "vitest";
import { isImeComposition } from "./keyboard";

describe("isImeComposition", () => {
  it("is true while composing", () => {
    expect(
      isImeComposition(
        new KeyboardEvent("keydown", { key: "Enter", isComposing: true }),
      ),
    ).toBe(true);
  });

  it("is true for the webkit composition keyCode", () => {
    expect(
      isImeComposition(
        new KeyboardEvent("keydown", { key: "Enter", keyCode: 229 }),
      ),
    ).toBe(true);
  });

  it("is false for a plain Enter", () => {
    expect(
      isImeComposition(
        new KeyboardEvent("keydown", { key: "Enter", keyCode: 13 }),
      ),
    ).toBe(false);
  });
});
