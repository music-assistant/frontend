import { CHIRP_PERIOD_SECONDS } from "@/helpers/sendspin-sync/chirp";
import {
  MAX_SPACING_ERROR,
  observedSpacing,
  spacingMatchesPeriod,
} from "@/helpers/sendspin-sync/chirpSpacing";
import { describe, expect, it } from "vitest";

const RATE = 48000;

/** How much of a chirp's arrival stands above the room, as the detector sees it. */
const PEAK = 40;

/**
 * A correlation envelope, which is what the spacing is read off.
 *
 * One narrow peak per chirp, an exponential reverberant tail behind each and a
 * noise floor throughout — the shape the matched filter produces, rather than the
 * audio that produced it.
 */
function envelope(options: {
  seconds: number;
  spacingSeconds: number;
  firstAt?: number;
  /** Peak height of the room's decay behind each chirp, and its time constant. */
  tail?: { gain: number; seconds: number };
  /** One late reflection per chirp, which must not be taken for a chirp itself. */
  reflection?: { delaySeconds: number; gain: number };
  noise?: number;
  seed?: number;
}): Float32Array {
  const length = Math.round(options.seconds * RATE);
  const buffer = new Float32Array(length);
  const tail = options.tail ?? { gain: 12, seconds: 0.12 };

  for (
    let at = options.firstAt ?? 0.0625;
    at < options.seconds;
    at += options.spacingSeconds
  ) {
    place(buffer, at, PEAK, tail);
    if (options.reflection)
      place(
        buffer,
        at + options.reflection.delaySeconds,
        options.reflection.gain,
        tail,
      );
  }

  addNoise(buffer, options.seed ?? 23, options.noise ?? 2);
  return buffer;
}

/**
 * Deterministic room noise, so a failure is always reproducible.
 *
 * The multiply is `Math.imul` because what is being tested is whether a recording
 * repeats: a 31-bit product rounded through a double loses its low bits, and the
 * sequence that comes back is periodic — a chirp train as far as this is
 * concerned, and one that would hide a real failure to notice it.
 */
function addNoise(buffer: Float32Array, seed: number, level: number): void {
  let state = seed;
  for (let index = 0; index < buffer.length; index++) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    buffer[index] += (state / 4294967296) * level;
  }
}

function place(
  buffer: Float32Array,
  at: number,
  gain: number,
  tail: { gain: number; seconds: number },
): void {
  const peak = Math.round(at * RATE);
  if (peak < 0 || peak >= buffer.length) return;
  buffer[peak] += gain;

  const decay = Math.round(tail.seconds * 4 * RATE);
  for (let step = 1; step < decay && peak + step < buffer.length; step++)
    buffer[peak + step] += tail.gain * Math.exp(-step / (tail.seconds * RATE));
}

describe("observedSpacing", () => {
  it("reads the spacing of a train arriving at the expected period", () => {
    const spacing = observedSpacing(
      envelope({ seconds: 8, spacingSeconds: CHIRP_PERIOD_SECONDS }),
      RATE,
    );

    expect(spacing).not.toBeNull();
    expect(spacing!).toBeCloseTo(CHIRP_PERIOD_SECONDS, 2);
    expect(spacingMatchesPeriod(spacing!)).toBe(true);
  });

  it("reads half a period when the server emits twice as often", () => {
    // The mismatch that will actually happen: a server still on the old rate. The
    // windows the detector searches would land on every other chirp and find one
    // in each, so nothing but the spacing itself shows this.
    const spacing = observedSpacing(
      envelope({ seconds: 8, spacingSeconds: CHIRP_PERIOD_SECONDS / 2 }),
      RATE,
    );

    expect(spacing!).toBeCloseTo(CHIRP_PERIOD_SECONDS / 2, 2);
    expect(spacingMatchesPeriod(spacing!)).toBe(false);
  });

  it("reads a spacing that is no simple fraction of the period either", () => {
    const spacing = observedSpacing(
      envelope({ seconds: 8, spacingSeconds: 1.5 * CHIRP_PERIOD_SECONDS }),
      RATE,
    );

    expect(spacing!).toBeCloseTo(1.5 * CHIRP_PERIOD_SECONDS, 2);
    expect(spacingMatchesPeriod(spacing!)).toBe(false);
  });

  it("takes the spacing, not the multiples of it the train also lines up on", () => {
    // A train lines up with itself at twice and three times its spacing as well,
    // and those readings would pass the check while the run was mis-numbered.
    const spacing = observedSpacing(
      envelope({ seconds: 12, spacingSeconds: CHIRP_PERIOD_SECONDS / 2 }),
      RATE,
    );

    expect(spacing!).toBeCloseTo(CHIRP_PERIOD_SECONDS / 2, 2);
  });

  it("is not fooled by a reflection long after the chirp that caused it", () => {
    // The reason this reads the whole pattern instead of picking peaks: a room can
    // still be audible a third of a second behind a chirp, and a peak that late
    // counted as an arrival of its own would read the spacing far too short.
    const spacing = observedSpacing(
      envelope({
        seconds: 8,
        spacingSeconds: CHIRP_PERIOD_SECONDS,
        reflection: { delaySeconds: 0.3, gain: PEAK },
      }),
      RATE,
    );

    expect(spacing!).toBeCloseTo(CHIRP_PERIOD_SECONDS, 2);
  });

  it("holds up while the chirps are barely above the room", () => {
    const spacing = observedSpacing(
      envelope({
        seconds: 8,
        spacingSeconds: CHIRP_PERIOD_SECONDS,
        tail: { gain: 2, seconds: 0.12 },
        noise: 4,
      }),
      RATE,
    );

    expect(spacing!).toBeCloseTo(CHIRP_PERIOD_SECONDS, 2);
  });

  it("says nothing at all about a recording with no chirps in it", () => {
    // Silence is not evidence of a mismatch, and reporting a spacing for it would
    // accuse the build of what is really a speaker nobody heard. Several seeds,
    // because what is being relied on is that noise does not repeat.
    for (const seed of [3, 23, 41, 97, 1009]) {
      const room = new Float32Array(Math.round(8 * RATE));
      addNoise(room, seed, 2);
      expect(observedSpacing(room, RATE)).toBeNull();
    }
  });

  it("says nothing about a recording too short to hold two chirps", () => {
    expect(
      observedSpacing(
        envelope({ seconds: 0.4, spacingSeconds: CHIRP_PERIOD_SECONDS }),
        RATE,
      ),
    ).toBeNull();
    expect(observedSpacing(new Float32Array(0), RATE)).toBeNull();
  });

  it("reads the same spacing whatever rate the browser captured at", () => {
    // The phone picks its own capture rate, and everything here is in seconds
    // because of it.
    for (const rate of [44100, 48000]) {
      const length = Math.round(8 * rate);
      const buffer = new Float32Array(length);
      for (let at = 0.1; at < 8; at += CHIRP_PERIOD_SECONDS)
        buffer[Math.round(at * rate)] = PEAK;

      expect(observedSpacing(buffer, rate)!).toBeCloseTo(
        CHIRP_PERIOD_SECONDS,
        2,
      );
    }
  });
});

describe("spacingMatchesPeriod", () => {
  it("admits a clock's own stretch and refuses a rate that is out", () => {
    // The worst clock the flow admits stretches the spacing by a thousandth, so
    // the tolerance is loose enough to never accuse a healthy run and tight enough
    // that a factor of two is nowhere near it.
    expect(spacingMatchesPeriod(CHIRP_PERIOD_SECONDS)).toBe(true);
    expect(spacingMatchesPeriod(CHIRP_PERIOD_SECONDS * 1.001)).toBe(true);
    expect(
      spacingMatchesPeriod(CHIRP_PERIOD_SECONDS * (1 + MAX_SPACING_ERROR / 2)),
    ).toBe(true);
    expect(
      spacingMatchesPeriod(CHIRP_PERIOD_SECONDS * (1 + MAX_SPACING_ERROR * 2)),
    ).toBe(false);
    expect(spacingMatchesPeriod(CHIRP_PERIOD_SECONDS / 2)).toBe(false);
    expect(spacingMatchesPeriod(CHIRP_PERIOD_SECONDS * 2)).toBe(false);
  });
});
