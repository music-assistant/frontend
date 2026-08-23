/**
 * Adaptive render quality controller for TV/cast dashboard displays.
 *
 * Receiver capability cannot be known in advance, so the controller walks the
 * adaptive pixel-budget ladder driven by measured frame cadence: it steps down
 * while samples come in struggling, climbs back when a heavy preset passes,
 * and stops stepping once a step down demonstrably did not help (the
 * bottleneck is not pixel fill). Every move is handed to the report callback,
 * since these displays have no reachable console.
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
// a level that could not hold twice is not tried again, so the ladder
// settles instead of oscillating
const TV_FAILURES_BEFORE_BLOCKED = 2;
// minimum speed-up for a step down to count as having helped ...
const TV_STEP_DOWN_PAYOFF = 1.15;
// ... capped just under the paced target: achieved fps can never exceed the
// target, so a lateness fix shows up as fps recovering to it, not surpassing it
const TV_PAYOFF_TARGET_SHARE = 0.95;

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
        callbacks.report(sample, level, "stuck at floor");
      }
      return;
    }
    const failures = (levelFailures.get(level) ?? 0) + 1;
    levelFailures.set(level, failures);
    if (failures >= TV_FAILURES_BEFORE_BLOCKED) ceiling = next;
    callbacks.report(sample, level, "stepped down");
    fpsBeforeStepDown = sample.fps;
    awaitingStepDownVerdict = true;
    applyLevel(next);
  };

  const onPerfSample = (sample: VisualizerPerfSample) => {
    // first sample after a step down decides whether pixels were ever the
    // problem
    if (awaitingStepDownVerdict) {
      awaitingStepDownVerdict = false;
      const payoffBar = Math.min(
        fpsBeforeStepDown * TV_STEP_DOWN_PAYOFF,
        sample.targetFps * TV_PAYOFF_TARGET_SHARE,
      );
      if (sample.fps < payoffBar) {
        fillBound = false;
        const back = level - 1;
        callbacks.report(sample, level, "step down did not pay");
        applyLevel(Math.max(back, ceiling));
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
        // pinned with nothing more to try; report the resting state once
        if (!settleReported) {
          settleReported = true;
          callbacks.report(sample, level, "pinned, not fill bound");
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
        callbacks.report(sample, level, "stepped up");
        applyLevel(next);
        return;
      }
      goodSamples = 0;
    }
    // report where it came to rest once, for displays with no reachable console
    steadySamples += 1;
    if (steadySamples === TV_SAMPLES_TO_SETTLE && !settleReported) {
      settleReported = true;
      callbacks.report(sample, level, "settled");
    }
  };

  return {
    currentProfile: () => adaptiveProfile(level),
    onPerfSample,
  };
}
