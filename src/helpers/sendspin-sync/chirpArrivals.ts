/**
 * Pulling every chirp arrival out of one speaker's recording.
 *
 * A recording covers several chirp periods, and the chirps inside it are spaced
 * by the server's clock rather than the phone's — so their positions are
 * predictable but not exactly known. Each one is located in its own narrow
 * window instead of by scanning the whole recording, which keeps the tail of the
 * previous chirp out of the search: in a reverberant room that tail can still be
 * loud enough half a second later to be taken for an arrival.
 *
 * The windows are placed from the loudest thing in the recording. That is
 * certainly a real chirp — whether the direct sound or a reflection of it — so
 * its position modulo the period is a reliable guide to where the others sit,
 * and the first-peak rule inside each window is what then picks the direct
 * arrival out from its own reflections.
 */

import { buildReferenceChirp, CHIRP_PERIOD_SECONDS } from "./chirp";
import {
  correlationEnvelope,
  findFirstArrival,
  noiseFloor,
} from "./matchedFilter";

/** One chirp, timed on the phone's audio clock. */
export interface DetectedArrival {
  /** Arrival time in seconds, on the same clock the frame counter runs on. */
  at: number;
  /** The arrival against the recording's noise floor. */
  snr: number;
}

export interface ArrivalScan {
  arrivals: DetectedArrival[];
  /** How many chirps the recording was long enough to hold. */
  expected: number;
  /** Typical peak-to-noise ratio of what was found; zero when nothing was. */
  medianSnr: number;
}

export interface ScanOptions {
  sampleRate: number;
  /**
   * Frame index of the recording's first sample.
   *
   * Counted by the capture worklet from the moment the graph was built and never
   * reset, so it is the phone's audio clock and the abscissa the latency fit
   * needs.
   */
  firstFrame: number;
}

/**
 * How far either side of its predicted position a chirp is searched for.
 *
 * Wide enough to cover the direct arrival sitting ahead of the reflection the
 * prediction was anchored on, and to absorb any plausible clock drift across a
 * recording. Far narrower than the half-period that would let the previous
 * chirp's reverberation in.
 */
const SEARCH_TOLERANCE_SECONDS = 0.025;

/** Scan one speaker's recording for the chirps the server played into it. */
export function scanArrivals(
  samples: Float32Array,
  options: ScanOptions,
): ArrivalScan {
  const { sampleRate, firstFrame } = options;
  const reference = buildReferenceChirp(sampleRate);
  const envelope = correlationEnvelope(samples, reference);
  if (!envelope.length) return { arrivals: [], expected: 0, medianSnr: 0 };

  const floor = noiseFloor(envelope);
  const period = CHIRP_PERIOD_SECONDS * sampleRate;
  const tolerance = SEARCH_TOLERANCE_SECONDS * sampleRate;

  const anchor = loudest(envelope) % period;
  const arrivals: DetectedArrival[] = [];
  let expected = 0;

  for (let slot = anchor; slot < envelope.length; slot += period) {
    const from = Math.round(slot - tolerance);
    const to = Math.round(slot + tolerance);
    // Only count a chirp as expected when its whole search window was recorded;
    // a partially captured one is not a miss worth reporting.
    if (from < 0 || to > envelope.length) continue;
    expected++;

    const found = findFirstArrival(envelope, { noiseFloor: floor, from, to });
    if (found)
      arrivals.push({
        at: (firstFrame + found.sample) / sampleRate,
        snr: found.snr,
      });
  }

  return {
    arrivals,
    expected,
    medianSnr: median(arrivals.map((a) => a.snr)),
  };
}

function loudest(envelope: Float32Array): number {
  let best = 0;
  for (let index = 1; index < envelope.length; index++)
    if (envelope[index] > envelope[best]) best = index;
  return best;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
