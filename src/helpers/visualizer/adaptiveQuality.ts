/**
 * Adaptive render quality controller for TV/cast dashboard displays.
 *
 * Receiver capability cannot be known in advance, so the controller walks the
 * adaptive pixel-budget ladder driven by measured frame cadence: it steps down
 * while samples come in struggling, climbs back when a heavy preset passes,
 * and stops stepping once a step down demonstrably did not help (the
 * bottleneck is not pixel fill). Every move is handed to the report callback,
 * since these displays have no reachable console.
 *
 * The ladder is deliberately the only mechanism. A chain of targeted remedies
 * (coarser mesh, blur clamp, instance clamp, reduced rate) used to live here;
 * engine-side fixes made them obsolete and their trial verdicts proved
 * unreliable around preset changes, so they were removed rather than hardened.
 */

import type { VisualizerPerfSample } from "@/composables/visualizer/useVisualizerEngine";
import {
  ADAPTIVE_LADDER,
  ADAPTIVE_START_LEVEL,
  adaptiveProfile,
  needsRebuild,
  type QualityProfile,
} from "@/helpers/visualizer/quality";

// render rate target, judged against the paced cadence rather than a fixed
// frame rate
export const TV_TARGET_FPS = 30;
const TV_LATE_RATIO_STEP_DOWN = 0.2;
const TV_LATE_RATIO_HOPELESS = 0.5;
const TV_LATE_RATIO_STEP_UP = 0.02;
const TV_FPS_SHORTFALL = 0.75;
const TV_LOW_SAMPLES_TO_STEP = 2;
const TV_GOOD_SAMPLES_TO_CLIMB = 6;
const TV_SAMPLES_TO_SETTLE = 5;
// a level that could not hold twice is not tried again for this preset, so
// the ladder settles instead of oscillating
const TV_FAILURES_BEFORE_BLOCKED = 2;
// minimum speed-up for a step down to count as having helped ...
const TV_STEP_DOWN_PAYOFF = 1.15;
// ... capped just under the paced target: achieved fps can never exceed the
// target, so a lateness fix shows up as fps recovering to it, not surpassing it
const TV_PAYOFF_TARGET_SHARE = 0.95;
// early samples cover module fetch and the first WASM preset compile, not rendering
const TV_WARMUP_SAMPLES = 3;
// heartbeat cadence in samples (~2s each), so a resting session keeps reporting
const TV_STEADY_REPORT_EVERY = 30;

export interface AdaptiveQualityCallbacks {
  /**
   * Put the given profile on screen. With `rebuild` false the running engine
   * can be retuned in place; true needs a fresh engine (mesh density and FXAA
   * are fixed at butterchurn's construction).
   */
  applyProfile(profile: QualityProfile, rebuild: boolean): void;
  /** Record how the display is rendering, for consoles nobody can reach. */
  report(sample: VisualizerPerfSample, level: number, note: string): void;
}

export interface AdaptiveQualityController {
  /** The ladder profile at the current level. */
  currentProfile(): QualityProfile;
  /** Feed a measured perf sample; steps the ladder through the callbacks. */
  onPerfSample(sample: VisualizerPerfSample): void;
}

export function createAdaptiveQualityController(
  callbacks: AdaptiveQualityCallbacks,
): AdaptiveQualityController {
  let level = ADAPTIVE_START_LEVEL;
  // sharpest level still allowed to be tried again
  let ceiling = 0;
  const levelFailures = new Map<number, number>();
  let lowSamples = 0;
  let goodSamples = 0;
  let steadySamples = 0;
  let settleReported = false;
  // cleared once a step down has been shown not to pay: a fill-rate remedy
  // cannot fix a non-fill bottleneck
  let fillBound = true;
  let fpsBeforeStepDown = 0;
  let awaitingStepDownVerdict = false;
  let floorReported = false;
  let ceilingReported = false;
  let warmupSamples = 0;
  let samplesSinceReport = 0;
  let lastPreset: string | undefined;

  const report = (sample: VisualizerPerfSample, note: string) => {
    samplesSinceReport = 0;
    callbacks.report(sample, level, note);
  };

  const applyLevel = (next: number) => {
    const from = adaptiveProfile(level);
    const to = adaptiveProfile(next);
    level = next;
    lowSamples = 0;
    goodSamples = 0;
    steadySamples = 0;
    settleReported = false;
    callbacks.applyProfile(to, needsRebuild(from, to));
  };

  const stepDown = (sample: VisualizerPerfSample) => {
    const next = level + 1;
    if (next >= ADAPTIVE_LADDER.length) {
      // nothing left to give up; say so once rather than going quiet
      if (!floorReported) {
        floorReported = true;
        report(sample, "stuck at floor");
      }
      return;
    }
    const failures = (levelFailures.get(level) ?? 0) + 1;
    levelFailures.set(level, failures);
    if (failures >= TV_FAILURES_BEFORE_BLOCKED) ceiling = next;
    fpsBeforeStepDown = sample.fps;
    awaitingStepDownVerdict = true;
    // reported after the move, so the level in the log is the one now on
    // screen; every other note reports the level in effect
    applyLevel(next);
    report(sample, "stepped down");
  };

  const onPerfSample = (sample: VisualizerPerfSample) => {
    if (warmupSamples < TV_WARMUP_SAMPLES) {
      warmupSamples += 1;
      lastPreset = sample.preset;
      return;
    }
    // A new preset is a new bottleneck profile, so every conclusion drawn
    // about the old one is dropped: the not-fill-bound verdict and the blocked
    // levels alike. Keeping the ceiling would let one heavy preset pin the
    // display for the rest of the session, since the climb is gated on it.
    // The climb still needs TV_GOOD_SAMPLES_TO_CLIMB clean samples, which
    // bounds the re-armed ladder to about one probe per preset.
    if (sample.preset !== lastPreset) {
      lastPreset = sample.preset;
      fillBound = true;
      ceiling = 0;
      levelFailures.clear();
      awaitingStepDownVerdict = false;
      settleReported = false;
      ceilingReported = false;
      floorReported = false;
      report(sample, "preset changed");
    }
    // heartbeat between state-change reports, so long resting stretches
    // (settled or pinned) stay visible in the log
    samplesSinceReport += 1;
    if (samplesSinceReport >= TV_STEADY_REPORT_EVERY) {
      report(sample, "steady");
    }

    // first sample after a step down decides whether pixels were ever the
    // problem
    if (awaitingStepDownVerdict) {
      awaitingStepDownVerdict = false;
      const payoffBar = Math.min(
        fpsBeforeStepDown * TV_STEP_DOWN_PAYOFF,
        sample.targetFps * TV_PAYOFF_TARGET_SHARE,
      );
      if (sample.fps < payoffBar) {
        report(sample, "step down did not pay");
        fillBound = false;
        applyLevel(Math.max(level - 1, ceiling));
        return;
      }
    }

    const struggling =
      sample.lateRatio > TV_LATE_RATIO_STEP_DOWN ||
      sample.fps < sample.targetFps * TV_FPS_SHORTFALL;

    if (struggling) {
      goodSamples = 0;
      steadySamples = 0;
      lowSamples += 1;
      const hopeless = sample.lateRatio > TV_LATE_RATIO_HOPELESS;
      if (!hopeless && lowSamples < TV_LOW_SAMPLES_TO_STEP) return;
      lowSamples = 0;
      if (!fillBound) {
        // pinned with nothing to try; report the resting state once
        if (!settleReported) {
          settleReported = true;
          report(sample, "pinned, not fill bound");
        }
        return;
      }
      stepDown(sample);
      return;
    }

    lowSamples = 0;
    if (sample.lateRatio > TV_LATE_RATIO_STEP_UP) {
      goodSamples = 0;
    } else {
      goodSamples += 1;
    }
    if (goodSamples >= TV_GOOD_SAMPLES_TO_CLIMB) {
      const next = level - 1;
      if (next >= ceiling) {
        applyLevel(next);
        report(sample, "stepped up");
        return;
      }
      goodSamples = 0;
      // Clean samples but a failed level in the way; say so once, as the floor
      // does. Level 0 with no failures behind it is not pinned, it is simply
      // the top of the ladder, and "settled" below already covers that.
      if (ceiling > 0 && !ceilingReported) {
        ceilingReported = true;
        report(sample, "pinned at ceiling");
      }
    }
    // report where it came to rest once, for displays with no reachable console
    steadySamples += 1;
    if (steadySamples === TV_SAMPLES_TO_SETTLE && !settleReported) {
      settleReported = true;
      report(sample, "settled");
    }
  };

  return {
    currentProfile: () => adaptiveProfile(level),
    onPerfSample,
  };
}
