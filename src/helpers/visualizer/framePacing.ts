/**
 * Display-tick estimation and render pacing for the visualizer's rAF loop.
 *
 * The loop's maxFps option is only an upper bound: rAF fires on the panel's
 * tick grid, so the cadence actually held is the panel rate over a whole
 * divisor. Everything needed to work out that divisor lives here, keeping the
 * engine to the butterchurn lifecycle.
 */

const REFRESH_WINDOW_TICKS = 120;
const MIN_TICK_MS = 1000 / 240;
const MAX_TICK_MS = 1000 / 30;
// Panels come in standard rates; under GPU throttling the rAF gaps are whole
// multiples of the true tick, so the estimator picks the slowest standard rate
// whose multiples explain the window instead of averaging throttled gaps into
// a phantom rate.
const STANDARD_TICKS_MS = [240, 165, 144, 120, 100, 90, 75, 60, 50, 30].map(
  (hz) => 1000 / hz,
);
// mean relative error a candidate tick may leave across the window
const TICK_FIT_TOLERANCE = 0.06;
// any single gap this far off a whole multiple disqualifies the candidate
// outright, so one wild gap cannot be averaged away by a well-behaved window
const TICK_FIT_OUTLIER_TOLERANCE = TICK_FIT_TOLERANCE * 3;
// pacing tolerance: a quarter of the target interval, capped at one tick
const PACING_TOLERANCE_SHARE = 0.25;
// float slop, so 25.000000000000004 / 8.333333333333334 lands on 3 ticks, not 4
const PACING_TICK_EPSILON = 1e-6;

export const DEFAULT_TICK_MS = 1000 / 60;

/**
 * The gap after which the pacing gate admits a render.
 *
 * rAF fires on the tick grid, so admitting the tick nearest the target
 * interval stays grid-aligned (no judder), and a GPU-throttled loop whose gaps
 * already exceed the interval is never skipped further.
 */
export function pacingThresholdMs(
  targetIntervalMs: number,
  tickMs: number,
): number {
  return (
    targetIntervalMs -
    Math.min(tickMs, targetIntervalMs * PACING_TOLERANCE_SHARE)
  );
}

/**
 * The interval the loop actually renders at: the smallest whole number of
 * display ticks that clears the pacing gate.
 *
 * The maxFps option is only an upper bound. Renders land on the tick grid, so
 * a 30fps cap on a 120Hz panel paces at every third tick (40fps), not 30, and
 * measuring against the cap would under-read both lateness and shortfall.
 */
export function pacedIntervalMs(
  targetIntervalMs: number,
  tickMs: number,
): number {
  if (!targetIntervalMs) return tickMs;
  const ticks = Math.max(
    1,
    Math.ceil(
      pacingThresholdMs(targetIntervalMs, tickMs) / tickMs -
        PACING_TICK_EPSILON,
    ),
  );
  return ticks * tickMs;
}

/**
 * The slowest standard panel rate whose whole multiples explain every gap in
 * the window, or null when no standard rate fits. Gaps must be positive; the
 * estimator drops the rest before they reach here.
 */
export function fitStandardTick(gaps: Float64Array): number | null {
  // slowest rate first: every gap trivially fits a fast-enough tick's
  // multiples, so the LARGEST tick that fits is the informative one
  for (let i = STANDARD_TICKS_MS.length - 1; i >= 0; i--) {
    const tick = STANDARD_TICKS_MS[i];
    let residual = 0;
    let ok = true;
    for (const gap of gaps) {
      const k = Math.max(1, Math.round(gap / tick));
      const err = Math.abs(gap - k * tick) / gap;
      if (err > TICK_FIT_OUTLIER_TOLERANCE) {
        ok = false;
        break;
      }
      residual += err;
    }
    if (ok && residual / gaps.length <= TICK_FIT_TOLERANCE) return tick;
  }
  return null;
}

// A slower estimate after a faster one almost always means throttling, not a
// slower panel, so the fastest is latched and engine rebuilds inherit it. A
// window dragged to a slower monitor stays latched and reads as throttled;
// only cast/TV hosts measure against this, and those never change panels.
let latchedTickMs: number | null = null;

/** Drop the latched panel rate. Test seam; the latch is otherwise permanent. */
export function resetLatchedTick(): void {
  latchedTickMs = null;
}

export interface TickEstimator {
  /** The current best estimate of the display tick, in ms. */
  readonly tickMs: number;
  /** Whether a full window has landed; before that tickMs is an assumption. */
  readonly estimated: boolean;
  /** Feed a rAF timestamp. Pass the previous one as `since`, or 0 to skip. */
  observe(now: number, since: number): void;
}

/**
 * Estimate the display tick from rAF gaps, latching the fastest rate proved.
 */
export function createTickEstimator(): TickEstimator {
  let tickMs = DEFAULT_TICK_MS;
  let estimated = false;
  let windowTicks = 0;
  const windowDeltas = new Float64Array(REFRESH_WINDOW_TICKS);

  return {
    get tickMs() {
      return tickMs;
    },
    get estimated() {
      return estimated;
    },
    observe(now: number, since: number) {
      // a non-positive gap says nothing about the tick grid, and would divide
      // by zero in the fit's relative error
      if (!since || now <= since) return;
      windowDeltas[windowTicks] = now - since;
      if (++windowTicks < REFRESH_WINDOW_TICKS) return;
      const fitted = fitStandardTick(windowDeltas);
      let estimate: number;
      if (fitted !== null) {
        estimate = fitted;
      } else {
        // no standard rate explains the window (wild jitter): fall back to
        // the median gap
        const sorted = Array.from(windowDeltas).sort((a, b) => a - b);
        estimate = sorted[REFRESH_WINDOW_TICKS >> 1];
      }
      latchedTickMs =
        latchedTickMs === null ? estimate : Math.min(latchedTickMs, estimate);
      tickMs = Math.min(Math.max(latchedTickMs, MIN_TICK_MS), MAX_TICK_MS);
      windowTicks = 0;
      estimated = true;
    },
  };
}
