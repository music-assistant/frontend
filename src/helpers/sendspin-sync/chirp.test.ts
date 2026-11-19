import {
  buildReferenceChirp,
  chirpPhase,
  CHIRP_END_HZ,
  CHIRP_PERIOD_SECONDS,
  CHIRP_SECONDS,
  CHIRP_START_HZ,
} from "@/helpers/sendspin-sync/chirp";
import { describe, expect, it } from "vitest";

/** The server's sample rate, and the frame count its own chirp.py works in. */
const SERVER_RATE = 48000;
const SERVER_CHIRP_FRAMES = 2880;

/**
 * Phases taken from the server's `chirp.py` at 48 kHz.
 *
 * The reference has to be the same waveform the server transmits, so these are
 * pinned against the other implementation rather than against this one.
 */
const SERVER_PHASES: [frame: number, phase: number][] = [
  [0, 0.0],
  [1, 0.06548136149042659],
  [720, 67.9854021274079],
  [1440, 203.95620638222368],
  [2160, 475.89781489185515],
  [2879, 1018.7343382690575],
  [2880, 1019.7810319111182],
];

/** Instantaneous frequency of the sweep, in Hz, at a point in the chirp. */
function instantaneousHz(progress: number): number {
  const step = 1e-6;
  const derivative =
    (chirpPhase(progress + step) - chirpPhase(progress - step)) / (2 * step);
  return derivative / (2 * Math.PI * CHIRP_SECONDS);
}

describe("CHIRP_PERIOD_SECONDS", () => {
  it("is the one second the server emits at", () => {
    // Pinned rather than derived, because it is agreed with the server's
    // `sendspin_sync` by hand and nothing at runtime negotiates it. A build that
    // moves off this alone counts every arrival against the wrong chirp.
    expect(CHIRP_PERIOD_SECONDS).toBe(1);
  });
});

describe("chirpPhase", () => {
  it("matches the server's phase at 48 kHz", () => {
    for (const [frame, expected] of SERVER_PHASES)
      expect(chirpPhase(frame / SERVER_CHIRP_FRAMES)).toBeCloseTo(expected, 9);
  });

  it("sweeps from the start frequency to the end frequency", () => {
    expect(instantaneousHz(0)).toBeCloseTo(CHIRP_START_HZ, 3);
    expect(instantaneousHz(1)).toBeCloseTo(CHIRP_END_HZ, 2);
  });

  it("rises logarithmically, so the halfway point is the geometric mean", () => {
    expect(instantaneousHz(0.5)).toBeCloseTo(
      Math.sqrt(CHIRP_START_HZ * CHIRP_END_HZ),
      3,
    );
  });
});

describe("buildReferenceChirp", () => {
  it("is one chirp long at whatever rate the browser gave us", () => {
    expect(buildReferenceChirp(SERVER_RATE)).toHaveLength(SERVER_CHIRP_FRAMES);
    expect(buildReferenceChirp(44100)).toHaveLength(
      Math.round(CHIRP_SECONDS * 44100),
    );
  });

  it("carries unit energy so a peak means the same at either rate", () => {
    for (const rate of [44100, 48000]) {
      const reference = buildReferenceChirp(rate);
      const energy = reference.reduce(
        (total, value) => total + value * value,
        0,
      );
      expect(energy).toBeCloseTo(1, 6);
    }
  });

  it("is windowed, so it starts and ends near silence", () => {
    const reference = buildReferenceChirp(SERVER_RATE);
    const peak = Math.max(...reference.map(Math.abs));

    expect(Math.abs(reference[0])).toBeLessThan(peak / 100);
    expect(Math.abs(reference[reference.length - 1])).toBeLessThan(peak / 20);
  });

  it("correlates with itself far more strongly than when misaligned", () => {
    const reference = buildReferenceChirp(SERVER_RATE);
    const dot = (shift: number) => {
      let total = 0;
      for (let i = 0; i + shift < reference.length; i++)
        total += reference[i + shift] * reference[i];
      return Math.abs(total);
    };

    // A matched filter is only useful if the sweep's autocorrelation collapses
    // away from zero lag; a tone would score nearly the same at every shift.
    expect(dot(0)).toBeCloseTo(1, 6);
    expect(dot(50)).toBeLessThan(0.1);
  });
});
