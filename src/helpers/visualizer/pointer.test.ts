import { afterEach, describe, expect, it, vi } from "vitest";
import { isHoverCapablePointer } from "./pointer";

describe("isHoverCapablePointer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("follows the hover media query", () => {
    const matchMedia = vi.fn(() => ({ matches: true }));
    vi.stubGlobal("matchMedia", matchMedia);
    expect(isHoverCapablePointer()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith(
      "(hover: hover) and (pointer: fine)",
    );
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(isHoverCapablePointer()).toBe(false);
  });

  it("is false without matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(isHoverCapablePointer()).toBe(false);
  });
});
