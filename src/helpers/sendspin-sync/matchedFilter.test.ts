import {
  buildReferenceChirp,
  chirpPhase,
  CHIRP_SECONDS,
} from "@/helpers/sendspin-sync/chirp";
import {
  correlationEnvelope,
  findFirstArrival,
  noiseFloor,
} from "@/helpers/sendspin-sync/matchedFilter";
import { describe, expect, it } from "vitest";

const RATE = 48000;
const CHIRP_LENGTH = Math.round(CHIRP_SECONDS * RATE);

/** One sample as milliseconds, which is the unit the acceptance bar is in. */
const SAMPLE_MS = 1000 / RATE;

/**
 * Add a chirp to `buffer` starting at `at`, which may be fractional.
 *
 * Evaluating the sweep at a shifted time rather than copying samples around is
 * what lets a test inject a delay finer than one sample, so the detector's
 * sub-sample claim is actually under test.
 */
function placeChirp(buffer: Float32Array, at: number, gain: number): void {
  const first = Math.ceil(at);
  for (let index = first; index < buffer.length; index++) {
    const progress = (index - at) / CHIRP_LENGTH;
    if (progress >= 1) break;
    const window = 0.5 * (1 - Math.cos(2 * Math.PI * progress));
    buffer[index] += gain * window * Math.sin(chirpPhase(progress));
  }
}

/** Deterministic room noise, so a failure is always reproducible. */
function addNoise(buffer: Float32Array, seed: number, level: number): void {
  let state = seed;
  for (let index = 0; index < buffer.length; index++) {
    state = (state * 1103515245 + 12345) % 2147483648;
    buffer[index] += (state / 2147483648 - 0.5) * level;
  }
}

/** Index of the tallest peak — what a global-maximum detector would return. */
function argmax(envelope: Float32Array): number {
  let best = 0;
  for (let index = 1; index < envelope.length; index++)
    if (envelope[index] > envelope[best]) best = index;
  return best;
}

function detect(buffer: Float32Array) {
  const envelope = correlationEnvelope(buffer, buildReferenceChirp(RATE));
  const found = findFirstArrival(envelope, {
    noiseFloor: noiseFloor(envelope),
  });
  return { envelope, found };
}

describe("correlationEnvelope", () => {
  it("is one entry per lag the reference fits at", () => {
    const buffer = new Float32Array(RATE);
    expect(correlationEnvelope(buffer, buildReferenceChirp(RATE))).toHaveLength(
      RATE - CHIRP_LENGTH + 1,
    );
  });

  it("has nothing to report when the reference is longer than the signal", () => {
    expect(
      correlationEnvelope(new Float32Array(100), buildReferenceChirp(RATE)),
    ).toHaveLength(0);
  });

  it("compresses the sweep into a pulse a fraction of a millisecond wide", () => {
    const buffer = new Float32Array(RATE);
    placeChirp(buffer, 10000, 1);
    const { envelope } = detect(buffer);

    // A 500-8000 Hz sweep should collapse to roughly the inverse of its
    // bandwidth, which is what makes timing it to a fraction of a sample sane.
    const peak = envelope[argmax(envelope)];
    let width = 0;
    for (const value of envelope) if (value > peak / 2) width++;
    expect(width * SAMPLE_MS).toBeLessThan(0.5);
  });
});

describe("findFirstArrival", () => {
  it("recovers an injected delay to well under a millisecond", () => {
    for (const at of [5000.0, 12345.37, 60000.82, 99999.5]) {
      const buffer = new Float32Array(3 * RATE);
      placeChirp(buffer, at, 0.5);
      addNoise(buffer, 11, 0.01);

      const { found } = detect(buffer);
      expect(found).not.toBeNull();
      expect(Math.abs(found!.sample - at) * SAMPLE_MS).toBeLessThan(0.05);
    }
  });

  it("takes the direct arrival even when a reflection comes back louder", () => {
    const direct = 20000;
    // A hard surface about half a metre further away, returning more energy than
    // the speaker sent straight at the phone.
    const reflection = direct + Math.round(0.003 * RATE);

    const buffer = new Float32Array(2 * RATE);
    placeChirp(buffer, direct, 0.45);
    placeChirp(buffer, reflection, 1);
    addNoise(buffer, 23, 0.01);

    const { envelope, found } = detect(buffer);
    expect(found).not.toBeNull();

    // The premise of the test: the tallest peak really is the reflection, so a
    // global-maximum detector would have measured the wrong path.
    expect(Math.abs(argmax(envelope) - reflection)).toBeLessThan(20);
    expect(found!.strongest).toBeGreaterThan(found!.level);

    expect(Math.abs(found!.sample - direct) * SAMPLE_MS).toBeLessThan(0.2);
  });

  it("still finds the direct arrival when the reflection is far louder", () => {
    const direct = 20000;
    const reflection = direct + Math.round(0.007 * RATE);

    const buffer = new Float32Array(2 * RATE);
    placeChirp(buffer, direct, 0.3);
    placeChirp(buffer, reflection, 1);
    addNoise(buffer, 29, 0.005);

    const { found } = detect(buffer);
    expect(Math.abs(found!.sample - direct) * SAMPLE_MS).toBeLessThan(0.2);
  });

  it("reports nothing when the speaker was never audible", () => {
    const buffer = new Float32Array(2 * RATE);
    addNoise(buffer, 31, 0.05);

    expect(detect(buffer).found).toBeNull();
  });

  it("reports nothing when the span is too small to hold a peak", () => {
    const buffer = new Float32Array(RATE);
    placeChirp(buffer, 10000, 1);
    const envelope = correlationEnvelope(buffer, buildReferenceChirp(RATE));

    expect(
      findFirstArrival(envelope, { noiseFloor: 0.001, from: 100, to: 101 }),
    ).toBeNull();
  });

  it("searches only the span it was given", () => {
    const buffer = new Float32Array(2 * RATE);
    placeChirp(buffer, 10000, 1);
    placeChirp(buffer, 50000, 1);
    const envelope = correlationEnvelope(buffer, buildReferenceChirp(RATE));
    const floor = noiseFloor(envelope);

    const early = findFirstArrival(envelope, { noiseFloor: floor, to: 30000 });
    const late = findFirstArrival(envelope, { noiseFloor: floor, from: 30000 });

    expect(early!.sample).toBeCloseTo(10000, 1);
    expect(late!.sample).toBeCloseTo(50000, 1);
  });

  it("measures the peak against the room, not against the loudest thing in it", () => {
    const buffer = new Float32Array(2 * RATE);
    placeChirp(buffer, 30000, 0.5);
    addNoise(buffer, 37, 0.01);

    const { found } = detect(buffer);
    expect(found!.snr).toBeGreaterThan(10);
  });
});
