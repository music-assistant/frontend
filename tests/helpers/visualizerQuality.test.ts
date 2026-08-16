import { qualityProfile, stepDownQuality } from "@/helpers/visualizer/quality";
import { describe, expect, it } from "vitest";

describe("stepDownQuality", () => {
  it("walks the adaptive ladder downward one tier at a time", () => {
    expect(stepDownQuality("native")).toBe("tv");
    expect(stepDownQuality("tv")).toBe("high");
    expect(stepDownQuality("high")).toBe("medium");
    expect(stepDownQuality("medium")).toBe("low");
  });

  it("stops at the bottom tier", () => {
    expect(stepDownQuality("low")).toBeNull();
  });

  it("does not guess for unknown values", () => {
    expect(stepDownQuality("ultra")).toBeNull();
    expect(stepDownQuality(undefined)).toBeNull();
  });
});

describe("qualityProfile", () => {
  it("resolves the internal tv tier without exposing it as a user choice", () => {
    const profile = qualityProfile("tv");
    // full dpr for panel sharpness, bounded render scale for the pixel load
    expect(profile.maxDpr).toBe(2);
    expect(profile.renderScale).toBeLessThan(1);
  });

  it("falls back to the default for unknown values", () => {
    expect(qualityProfile("nonsense")).toEqual(qualityProfile(undefined));
  });
});
