/**
 * The maxFps option is only an upper bound: renders land on the tick grid, so
 * the cadence the loop actually holds is the panel rate over a whole divisor.
 * Reporting the cap instead of that cadence would under-read both the fps
 * shortfall and the lateness the adaptive controller steps on.
 */
import {
  createTickEstimator,
  DEFAULT_TICK_MS,
  fitStandardTick,
  pacedIntervalMs,
  resetLatchedTick,
} from "./framePacing";
import { beforeEach, describe, expect, it } from "vitest";

const HZ = (hz: number) => 1000 / hz;
const CAP_30 = 1000 / 30;

describe("pacedIntervalMs", () => {
  it("matches the cap when it is a whole divisor of the panel", () => {
    expect(pacedIntervalMs(CAP_30, HZ(60))).toBeCloseTo(HZ(30), 6);
  });

  it("paces faster than a 30fps cap on a 120Hz panel", () => {
    // every third tick, not every fourth: 40fps, which is what the gate admits
    expect(pacedIntervalMs(CAP_30, HZ(120))).toBeCloseTo(HZ(40), 6);
    expect(1000 / pacedIntervalMs(CAP_30, HZ(120))).toBeCloseTo(40, 6);
  });

  it("paces slower than the cap when no divisor reaches it", () => {
    // a 50Hz panel can only do 25fps under a 30fps cap
    expect(pacedIntervalMs(CAP_30, HZ(50))).toBeCloseTo(HZ(25), 6);
  });

  it("lands on whole ticks for every standard panel rate", () => {
    for (const hz of [50, 60, 75, 90, 100, 120, 144, 165, 240]) {
      const tick = HZ(hz);
      const ticks = pacedIntervalMs(CAP_30, tick) / tick;
      expect(ticks).toBeCloseTo(Math.round(ticks), 6);
      expect(ticks).toBeGreaterThanOrEqual(1);
    }
  });

  it("renders every tick when nothing caps the rate", () => {
    expect(pacedIntervalMs(0, HZ(120))).toBe(HZ(120));
  });
});

describe("fitStandardTick", () => {
  const gaps = (ms: number, jitter = 0) =>
    Float64Array.from({ length: 120 }, (_, i) =>
      i % 2 ? ms + jitter : ms - jitter,
    );

  it("recognises an unthrottled panel rate", () => {
    expect(fitStandardTick(gaps(HZ(120)))).toBeCloseTo(HZ(120), 6);
    expect(fitStandardTick(gaps(HZ(60)))).toBeCloseTo(HZ(60), 6);
  });

  it("tolerates jitter inside the fit band", () => {
    expect(fitStandardTick(gaps(HZ(60), 0.4))).toBeCloseTo(HZ(60), 6);
  });

  it("rejects a candidate on one wild gap the rest of the window would average away", () => {
    const window = gaps(HZ(60));
    window[7] = HZ(60) * 1.4;
    expect(fitStandardTick(window)).not.toBeCloseTo(HZ(60), 6);
  });

  it("gives up on a window no standard rate explains", () => {
    const wild = Float64Array.from({ length: 120 }, (_, i) => 5 + (i % 7) * 9);
    expect(fitStandardTick(wild)).toBeNull();
  });
});

/**
 * The panel rate is a device property, so the estimator keeps the fastest tick
 * any window has proved: a later slow window means the GPU is throttling the
 * loop, not that the panel got slower.
 */
describe("createTickEstimator", () => {
  beforeEach(() => resetLatchedTick());

  const feed = (
    estimator: ReturnType<typeof createTickEstimator>,
    tickMs: number,
    count = 121,
  ) => {
    let at = 0;
    for (let i = 0; i < count; i++) {
      const now = at + tickMs;
      estimator.observe(now, at);
      at = now;
    }
  };

  it("assumes 60Hz until a full window lands", () => {
    const estimator = createTickEstimator();
    estimator.observe(1000, 0);
    expect(estimator.estimated).toBe(false);
    expect(estimator.tickMs).toBe(DEFAULT_TICK_MS);
  });

  it("estimates the panel rate once a window lands", () => {
    const estimator = createTickEstimator();
    feed(estimator, HZ(120));
    expect(estimator.estimated).toBe(true);
    expect(estimator.tickMs).toBeCloseTo(HZ(120), 6);
  });

  it("keeps the fastest tick proved, so throttling cannot slow the estimate", () => {
    const first = createTickEstimator();
    feed(first, HZ(120));
    // a second engine on the same display, now throttled to half rate
    const second = createTickEstimator();
    feed(second, HZ(60));
    expect(second.tickMs).toBeCloseTo(HZ(120), 6);
  });
});
