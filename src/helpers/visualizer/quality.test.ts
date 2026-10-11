import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_LADDER,
  ADAPTIVE_START_LEVEL,
  adaptiveProfile,
  boundedRenderSize,
  DEFAULT_QUALITY,
  needsRebuild,
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

  it("leaves user tiers unbudgeted, so a chosen tier is what gets rendered", () => {
    for (const profile of Object.values(QUALITY_PROFILES)) {
      expect(profile.maxPixels).toBeUndefined();
    }
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

describe("the adaptive ladder", () => {
  it("descends in pixel budget without ever asking for more mesh work", () => {
    for (let i = 1; i < ADAPTIVE_LADDER.length; i++) {
      const above = ADAPTIVE_LADDER[i - 1];
      const step = ADAPTIVE_LADDER[i];
      expect(step.maxPixels!).toBeLessThan(above.maxPixels!);
      expect(step.meshWidth * step.meshHeight).toBeLessThanOrEqual(
        above.meshWidth * above.meshHeight,
      );
    }
  });

  it("keeps every step but the last an in-place resize", () => {
    const rebuilds = ADAPTIVE_LADDER.filter(
      (step, i) => i > 0 && needsRebuild(ADAPTIVE_LADDER[i - 1], step),
    );
    expect(rebuilds).toHaveLength(1);
    expect(rebuilds[0]).toBe(ADAPTIVE_LADDER[ADAPTIVE_LADDER.length - 1]);
  });

  it("starts below the top so there is somewhere to climb", () => {
    expect(ADAPTIVE_START_LEVEL).toBeGreaterThan(0);
    expect(ADAPTIVE_START_LEVEL).toBeLessThan(ADAPTIVE_LADDER.length - 1);
  });

  it("clamps levels beyond either end of the ladder", () => {
    expect(adaptiveProfile(-5)).toBe(ADAPTIVE_LADDER[0]);
    expect(adaptiveProfile(99)).toBe(
      ADAPTIVE_LADDER[ADAPTIVE_LADDER.length - 1],
    );
  });
});
