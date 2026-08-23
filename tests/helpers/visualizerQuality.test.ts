import {
  ADAPTIVE_LADDER,
  ADAPTIVE_START_LEVEL,
  QUALITY_PROFILES,
  adaptiveProfile,
  needsRebuild,
  qualityProfile,
} from "@/helpers/visualizer/quality";
import { describe, expect, it } from "vitest";

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

describe("qualityProfile", () => {
  it("resolves user-facing tiers", () => {
    expect(qualityProfile("native")).toBe(QUALITY_PROFILES.native);
  });

  it("falls back to the default for unknown values", () => {
    expect(qualityProfile("nonsense")).toEqual(qualityProfile(undefined));
  });

  it("leaves user tiers unbudgeted, so a chosen tier is what gets rendered", () => {
    for (const profile of Object.values(QUALITY_PROFILES)) {
      expect(profile.maxPixels).toBeUndefined();
    }
  });
});
