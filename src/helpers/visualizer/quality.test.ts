import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_LADDER,
  boundedRenderSize,
  DEFAULT_QUALITY,
  QUALITY_PROFILES,
  qualityProfile,
} from "./quality";

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

describe("boundedRenderSize", () => {
  const profile = (
    overrides: Partial<(typeof ADAPTIVE_LADDER)[number]>,
  ): (typeof ADAPTIVE_LADDER)[number] => ({
    ...QUALITY_PROFILES.high,
    ...overrides,
  });

  it("passes an unbounded profile through unchanged", () => {
    expect(boundedRenderSize(1920, 1080, profile({}))).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("clamps a wide buffer to a square when maxAspect is 1", () => {
    expect(boundedRenderSize(1920, 1080, profile({ maxAspect: 1 }))).toEqual({
      width: 1080,
      height: 1080,
    });
  });

  it("clamps a tall buffer symmetrically", () => {
    expect(boundedRenderSize(1080, 1920, profile({ maxAspect: 1 }))).toEqual({
      width: 1080,
      height: 1080,
    });
  });

  it("shrinks to the pixel budget preserving aspect", () => {
    const { width, height } = boundedRenderSize(
      1920,
      1080,
      profile({ maxPixels: 1_470_000 }),
    );
    expect(width * height).toBeLessThanOrEqual(1_470_000);
    expect(width / height).toBeCloseTo(16 / 9, 2);
  });

  it("applies the aspect cap before the budget", () => {
    const { width, height } = boundedRenderSize(
      1920,
      1080,
      profile({ maxAspect: 1, maxPixels: 720_000 }),
    );
    expect(width).toBe(height);
    expect(width * height).toBeLessThanOrEqual(720_000);
  });

  it("keeps a zero size as-is so callers can treat it as not laid out", () => {
    expect(boundedRenderSize(0, 0, profile({ maxAspect: 1 }))).toEqual({
      width: 0,
      height: 0,
    });
  });

  it("caps every adaptive ladder step to a square render", () => {
    for (const step of ADAPTIVE_LADDER) {
      expect(step.maxAspect).toBe(1);
    }
  });
});
