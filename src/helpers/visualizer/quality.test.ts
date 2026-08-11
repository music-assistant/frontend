import { describe, expect, it } from "vitest";
import { DEFAULT_QUALITY, QUALITY_PROFILES, qualityProfile } from "./quality";

describe("qualityProfile", () => {
  it("resolves known tiers", () => {
    expect(qualityProfile("low")).toBe(QUALITY_PROFILES.low);
    expect(qualityProfile("native")).toBe(QUALITY_PROFILES.native);
  });

  it("falls back to the default for unknown or missing values", () => {
    expect(qualityProfile(undefined)).toBe(QUALITY_PROFILES[DEFAULT_QUALITY]);
    expect(qualityProfile("ultra")).toBe(QUALITY_PROFILES[DEFAULT_QUALITY]);
    expect(qualityProfile("")).toBe(QUALITY_PROFILES[DEFAULT_QUALITY]);
  });

  it("orders tiers by increasing cost", () => {
    const cost = (tier: keyof typeof QUALITY_PROFILES) => {
      const p = QUALITY_PROFILES[tier];
      return p.renderScale * p.maxDpr * p.meshWidth * p.meshHeight;
    };
    expect(cost("low")).toBeLessThan(cost("medium"));
    expect(cost("medium")).toBeLessThan(cost("high"));
    expect(cost("high")).toBeLessThan(cost("native"));
  });
});
