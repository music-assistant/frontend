/**
 * Tests for the adaptive quality controller driving TV/cast displays: it
 * steps down the pixel-budget ladder while samples come in struggling,
 * verifies each step down actually paid off, climbs back on sustained
 * headroom, blocks levels that failed twice, and reports every move for
 * displays with no reachable console.
 */
import type { VisualizerPerfSample } from "@/helpers/visualizer/perfSampler";
import {
  createAdaptiveQualityController,
  type AdaptiveQualityController,
} from "./adaptiveQuality";
import { ADAPTIVE_LADDER, ADAPTIVE_START_LEVEL } from "./quality";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sample = (
  over: Partial<VisualizerPerfSample> = {},
): VisualizerPerfSample => ({
  fps: 30,
  targetFps: 30,
  lateRatio: 0,
  pixels: 1_000_000,
  renderMs: 5,
  blockedRatio: 0,
  preset: "some preset",
  ...over,
});

// throughput collapse: below the 75% shortfall line
const slow = () => sample({ fps: 20 });
// lateness without throughput collapse: over the 0.2 late-ratio line while
// fps stays within 75% of target
const late = () => sample({ lateRatio: 0.25, fps: 27.5 });
const good = () => sample();

const notes = (report: ReturnType<typeof vi.fn>) =>
  report.mock.calls.map((call) => call[2]);

describe("the adaptive quality controller", () => {
  const applyProfile = vi.fn();
  const report = vi.fn();
  let controller: AdaptiveQualityController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = createAdaptiveQualityController({ applyProfile, report });
    // the first three samples are warm-up (module fetch, first preset
    // compile) and are ignored entirely
    for (let i = 0; i < 3; i++) controller.onPerfSample(good());
  });

  it("starts at the ladder's start level", () => {
    expect(controller.currentProfile()).toBe(
      ADAPTIVE_LADDER[ADAPTIVE_START_LEVEL],
    );
  });

  it("holds through a single struggling sample", () => {
    controller.onPerfSample(slow());
    expect(applyProfile).not.toHaveBeenCalled();
  });

  it("steps down in place after two consecutive struggling samples", () => {
    controller.onPerfSample(slow());
    controller.onPerfSample(slow());
    expect(applyProfile).toHaveBeenCalledExactlyOnceWith(
      ADAPTIVE_LADDER[ADAPTIVE_START_LEVEL + 1],
      false,
    );
    expect(notes(report)).toEqual(["stepped down"]);
    expect(controller.currentProfile()).toBe(
      ADAPTIVE_LADDER[ADAPTIVE_START_LEVEL + 1],
    );
  });

  it("steps down immediately when lateness is hopeless", () => {
    controller.onPerfSample(sample({ lateRatio: 0.6, fps: 15 }));
    expect(applyProfile).toHaveBeenCalledExactlyOnceWith(
      ADAPTIVE_LADDER[ADAPTIVE_START_LEVEL + 1],
      false,
    );
  });

  it("pins when a step down does not pay, and reports it once", () => {
    controller.onPerfSample(slow());
    controller.onPerfSample(slow());
    // barely faster than the fps 20 before the step: pixels were not the
    // problem, so the ladder gives up instead of blurring pointlessly
    controller.onPerfSample(sample({ fps: 21 }));
    expect(notes(report)).toContain("step down did not pay");
    expect(controller.currentProfile()).toBe(
      ADAPTIVE_LADDER[ADAPTIVE_START_LEVEL],
    );

    controller.onPerfSample(slow());
    controller.onPerfSample(slow());
    controller.onPerfSample(slow());
    controller.onPerfSample(slow());
    expect(
      notes(report).filter((note) => note === "pinned, not fill bound"),
    ).toHaveLength(1);
    // no further ladder moves while pinned
    expect(applyProfile).toHaveBeenCalledTimes(2);
  });

  it("re-arms the ladder when the preset changes", () => {
    // conclude "not fill bound" on the first preset
    controller.onPerfSample(slow());
    controller.onPerfSample(slow());
    controller.onPerfSample(sample({ fps: 21 }));
    controller.onPerfSample(slow());
    controller.onPerfSample(slow());
    expect(notes(report)).toContain("pinned, not fill bound");
    const applied = applyProfile.mock.calls.length;

    // a new preset may well be fill bound; the ladder steps for it again
    const heavy = () => sample({ fps: 12, lateRatio: 0.6, preset: "other" });
    controller.onPerfSample(heavy());
    expect(notes(report)).toContain("preset changed");
    controller.onPerfSample(heavy());
    expect(applyProfile.mock.calls.length).toBeGreaterThan(applied);
    expect(
      notes(report).filter((note) => note === "stepped down").length,
    ).toBeGreaterThan(1);
  });

  it("counts a lateness fix as payoff even though fps is capped at the target", () => {
    // struggling on lateness alone, fps already close to the 30fps target: a
    // successful step down can only bring fps back TO the target, never 15%
    // beyond it, so the payoff bar must sit below the target
    controller.onPerfSample(late());
    controller.onPerfSample(late());
    expect(notes(report)).toEqual(["stepped down"]);
    controller.onPerfSample(sample({ fps: 29.8, lateRatio: 0.01 }));
    expect(notes(report)).not.toContain("step down did not pay");
    expect(applyProfile).toHaveBeenCalledTimes(1);
    expect(controller.currentProfile()).toBe(
      ADAPTIVE_LADDER[ADAPTIVE_START_LEVEL + 1],
    );

    // fill still trusted: renewed struggle steps down again instead of pinning
    controller.onPerfSample(late());
    controller.onPerfSample(late());
    expect(applyProfile).toHaveBeenLastCalledWith(
      ADAPTIVE_LADDER[ADAPTIVE_START_LEVEL + 2],
      false,
    );
  });

  it("climbs back after sustained clean samples", () => {
    controller.onPerfSample(slow());
    controller.onPerfSample(slow());
    for (let i = 0; i < 6; i++) controller.onPerfSample(good());
    expect(applyProfile).toHaveBeenLastCalledWith(
      ADAPTIVE_LADDER[ADAPTIVE_START_LEVEL],
      false,
    );
    expect(notes(report)).toContain("stepped up");
  });

  it("reports where it settled, once", () => {
    for (let i = 0; i < 5; i++) controller.onPerfSample(good());
    expect(notes(report).filter((note) => note === "settled")).toHaveLength(1);
    expect(report).toHaveBeenCalledWith(
      expect.anything(),
      ADAPTIVE_START_LEVEL,
      "settled",
    );
  });

  it("does not retry a level that failed to hold twice", () => {
    // first failure of the start level, then climb back up to it
    controller.onPerfSample(slow());
    controller.onPerfSample(slow());
    for (let i = 0; i < 6; i++) controller.onPerfSample(good());
    // second failure: the start level is now blocked
    controller.onPerfSample(slow());
    controller.onPerfSample(slow());
    const applied = applyProfile.mock.calls.length;
    // sustained headroom below no longer climbs into the blocked level
    for (let i = 0; i < 12; i++) controller.onPerfSample(good());
    expect(applyProfile).toHaveBeenCalledTimes(applied);
    expect(notes(report).filter((note) => note === "stepped up")).toHaveLength(
      1,
    );
  });

  it("reports being pinned by a blocked level, once", () => {
    controller.onPerfSample(slow());
    controller.onPerfSample(slow());
    for (let i = 0; i < 6; i++) controller.onPerfSample(good());
    controller.onPerfSample(slow());
    controller.onPerfSample(slow());
    for (let i = 0; i < 24; i++) controller.onPerfSample(good());
    expect(
      notes(report).filter((note) => note === "pinned at ceiling"),
    ).toHaveLength(1);
  });

  it("never calls the top of the ladder a ceiling", () => {
    // clean from the start: it climbs to level 0 and rests there, which is
    // headroom, not a level something failed at
    for (let i = 0; i < 30; i++) controller.onPerfSample(good());
    expect(notes(report)).toContain("stepped up");
    expect(notes(report)).not.toContain("pinned at ceiling");
  });

  it("unblocks the failed levels when the preset changes", () => {
    // pin the start level with two failures, as above
    controller.onPerfSample(slow());
    controller.onPerfSample(slow());
    for (let i = 0; i < 6; i++) controller.onPerfSample(good());
    controller.onPerfSample(slow());
    controller.onPerfSample(slow());
    const pinned = controller.currentProfile();

    // A heavy preset must not cap the display for the rest of the session:
    // the next preset is a fresh bottleneck profile, so the blocked levels go
    // with the not-fill-bound verdict.
    controller.onPerfSample(sample({ preset: "another preset" }));
    for (let i = 0; i < 12; i++)
      controller.onPerfSample(sample({ preset: "another preset" }));
    expect(controller.currentProfile()).not.toBe(pinned);
    expect(ADAPTIVE_LADDER.indexOf(controller.currentProfile())).toBeLessThan(
      ADAPTIVE_LADDER.indexOf(pinned),
    );
  });

  it("reports the ladder floor once instead of going quiet", () => {
    // hopeless lateness marches straight down; each verdict passes because
    // fps improves by more than the payoff factor after every step
    let fps = 10;
    for (let level = ADAPTIVE_START_LEVEL; level < ADAPTIVE_LADDER.length; ) {
      controller.onPerfSample(sample({ lateRatio: 0.6, fps }));
      fps *= 1.2;
      level += 1;
    }
    controller.onPerfSample(sample({ lateRatio: 0.6, fps }));
    expect(controller.currentProfile()).toBe(
      ADAPTIVE_LADDER[ADAPTIVE_LADDER.length - 1],
    );
    // the final ladder step drops mesh/FXAA, so that one needs a rebuild
    expect(applyProfile).toHaveBeenLastCalledWith(
      ADAPTIVE_LADDER[ADAPTIVE_LADDER.length - 1],
      true,
    );
    expect(
      notes(report).filter((note) => note === "stuck at floor"),
    ).toHaveLength(1);
  });
});
