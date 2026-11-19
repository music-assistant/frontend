import {
  chirpPhase,
  CHIRP_PERIOD_SECONDS,
  CHIRP_SECONDS,
} from "@/helpers/sendspin-sync/chirp";
import { scanArrivals } from "@/helpers/sendspin-sync/chirpArrivals";
import { describe, expect, it } from "vitest";

const RATE = 48000;
const PERIOD = CHIRP_PERIOD_SECONDS * RATE;
const CHIRP_LENGTH = Math.round(CHIRP_SECONDS * RATE);

/** As long as one visit records, so the recordings here are the real ones. */
const RECORDING_SECONDS = 8 * CHIRP_PERIOD_SECONDS;

/** Chirps a recording that long holds, whichever period it is spaced by. */
const CHIRPS_HELD = 7;

function placeChirp(buffer: Float32Array, at: number, gain: number): void {
  for (let index = Math.max(0, Math.ceil(at)); index < buffer.length; index++) {
    const progress = (index - at) / CHIRP_LENGTH;
    if (progress >= 1) break;
    if (progress < 0) continue;
    const window = 0.5 * (1 - Math.cos(2 * Math.PI * progress));
    buffer[index] += gain * window * Math.sin(chirpPhase(progress));
  }
}

/**
 * Deterministic room noise, so a failure is always reproducible.
 *
 * The multiply is `Math.imul` because the generator has to produce noise and not
 * merely irregular numbers: a 31-bit product rounded through a double loses its
 * low bits, and the sequence that comes back is periodic — which the spacing
 * measurement would read as a chirp train of its own.
 */
function addNoise(buffer: Float32Array, seed: number, level: number): void {
  let state = seed;
  for (let index = 0; index < buffer.length; index++) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    buffer[index] += (state / 4294967296 - 0.5) * level;
  }
}

/**
 * A recording of one speaker.
 *
 * `firstChirpAt` is where the first chirp lands, `drift` stretches the spacing the
 * way a phone clock running at its own rate does, `spacing` is the rate the server
 * emitted at where that is the point of the case, and every chirp is followed by
 * a louder reflection so the direct arrival is never the tallest peak.
 */
function record(options: {
  seconds: number;
  firstChirpAt: number;
  drift?: number;
  spacingSeconds?: number;
  reflection?: { delaySeconds: number; gain: number };
  noise?: number;
}): Float32Array {
  const buffer = new Float32Array(Math.round(options.seconds * RATE));
  const spacing =
    (options.spacingSeconds ?? CHIRP_PERIOD_SECONDS) *
    RATE *
    (1 + (options.drift ?? 0));

  for (let at = options.firstChirpAt; at < buffer.length; at += spacing) {
    placeChirp(buffer, at, 0.5);
    if (options.reflection)
      placeChirp(
        buffer,
        at + options.reflection.delaySeconds * RATE,
        options.reflection.gain,
      );
  }
  addNoise(buffer, 17, options.noise ?? 0.01);
  return buffer;
}

describe("scanArrivals", () => {
  it("finds every chirp the recording was long enough to hold", () => {
    const buffer = record({ seconds: RECORDING_SECONDS, firstChirpAt: 3000 });
    const scan = scanArrivals(buffer, { sampleRate: RATE, firstFrame: 0 });

    expect(scan.expected).toBeGreaterThanOrEqual(CHIRPS_HELD);
    expect(scan.arrivals).toHaveLength(scan.expected);
    expect(scan.medianSnr).toBeGreaterThan(10);
  });

  it("times each chirp against the phone's own frame counter", () => {
    const firstFrame = 4_800_000;
    const firstChirpAt = 3000;
    const buffer = record({ seconds: RECORDING_SECONDS, firstChirpAt });
    const scan = scanArrivals(buffer, { sampleRate: RATE, firstFrame });

    scan.arrivals.forEach((arrival, index) => {
      const expected = (firstFrame + firstChirpAt + index * PERIOD) / RATE;
      expect(Math.abs(arrival.at - expected) * 1000).toBeLessThan(0.05);
    });
  });

  it("keeps the spacing the server clock set, not the one the phone assumed", () => {
    // 200 ppm: the arrivals must come out spaced by the recording's own rate,
    // which is what the latency fit later reads the clock error off.
    const buffer = record({
      seconds: RECORDING_SECONDS,
      firstChirpAt: 3000,
      drift: 200e-6,
    });
    const scan = scanArrivals(buffer, { sampleRate: RATE, firstFrame: 0 });

    expect(scan.arrivals.length).toBeGreaterThanOrEqual(CHIRPS_HELD);
    const gaps = scan.arrivals
      .slice(1)
      .map((arrival, index) => arrival.at - scan.arrivals[index].at);
    for (const gap of gaps)
      expect(gap).toBeCloseTo(CHIRP_PERIOD_SECONDS * (1 + 200e-6), 5);
  });

  it("times the direct arrival, not the louder reflection after it", () => {
    const firstChirpAt = 3000;
    const buffer = record({
      seconds: RECORDING_SECONDS,
      firstChirpAt,
      reflection: { delaySeconds: 0.004, gain: 1 },
    });
    const scan = scanArrivals(buffer, { sampleRate: RATE, firstFrame: 0 });

    expect(scan.arrivals.length).toBeGreaterThanOrEqual(CHIRPS_HELD);
    scan.arrivals.forEach((arrival, index) => {
      const expected = (firstChirpAt + index * PERIOD) / RATE;
      expect(Math.abs(arrival.at - expected) * 1000).toBeLessThan(0.3);
    });
  });

  it("reports the spacing the chirps in the recording actually had", () => {
    const buffer = record({ seconds: RECORDING_SECONDS, firstChirpAt: 3000 });
    const scan = scanArrivals(buffer, { sampleRate: RATE, firstFrame: 0 });

    expect(scan.spacingSeconds!).toBeCloseTo(CHIRP_PERIOD_SECONDS, 2);
  });

  it("reports half a period from a server still emitting twice as often", () => {
    // The windows are placed on the period this build expects, so they land on
    // every other chirp and each one holds an arrival: the reading looks perfectly
    // healthy, and only the spacing says the two sides are out of step.
    const buffer = record({
      seconds: RECORDING_SECONDS,
      firstChirpAt: 3000,
      spacingSeconds: CHIRP_PERIOD_SECONDS / 2,
    });
    const scan = scanArrivals(buffer, { sampleRate: RATE, firstFrame: 0 });

    expect(scan.arrivals.length).toBeGreaterThanOrEqual(CHIRPS_HELD);
    expect(scan.spacingSeconds!).toBeCloseTo(CHIRP_PERIOD_SECONDS / 2, 2);
  });

  it("reports nothing when the speaker was never audible", () => {
    const buffer = new Float32Array(Math.round(RECORDING_SECONDS * RATE));
    addNoise(buffer, 41, 0.05);

    const scan = scanArrivals(buffer, { sampleRate: RATE, firstFrame: 0 });
    expect(scan.arrivals).toHaveLength(0);
    expect(scan.medianSnr).toBe(0);
    // And no spacing either: a speaker nobody heard is not a server emitting at
    // the wrong rate, and reporting one for it would say so.
    expect(scan.spacingSeconds).toBeNull();
  });

  it("has nothing to say about a recording shorter than one chirp", () => {
    const scan = scanArrivals(new Float32Array(100), {
      sampleRate: RATE,
      firstFrame: 0,
    });
    expect(scan).toEqual({
      arrivals: [],
      expected: 0,
      medianSnr: 0,
      spacingSeconds: null,
    });
  });
});
