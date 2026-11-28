/**
 * How much a single speaker's measurement is worth.
 *
 * Two things independently spoil a reading, and both have to be visible while the
 * user is still standing next to the speaker and can do something about it. Too
 * few chirps found means the speaker was not really audible from where the phone
 * was held. A weak peak against the room means it was audible but swamped, which
 * a matched filter survives far better than an onset detector but not without
 * limit.
 */

/** Fraction of the expected chirps that must be found for a solid reading. */
const GOOD_YIELD = 0.8;
const WEAK_YIELD = 0.4;

/**
 * Peak-to-noise ratio a solid reading reaches.
 *
 * The detector already refuses anything below 6, so this is the margin above bare
 * detectability at which sub-sample timing is trustworthy rather than merely
 * possible.
 */
const GOOD_SNR = 12;

export type Confidence = "good" | "weak" | "poor";

export interface ConfidenceInput {
  found: number;
  expected: number;
  medianSnr: number;
}

/** Rate one speaker's measurement from what the scan actually recovered. */
export function measurementConfidence(scan: ConfidenceInput): Confidence {
  const { found, expected, medianSnr } = scan;
  if (found === 0 || expected === 0) return "poor";

  const yielded = found / expected;
  if (yielded >= GOOD_YIELD && medianSnr >= GOOD_SNR) return "good";
  if (yielded >= WEAK_YIELD) return "weak";
  return "poor";
}
