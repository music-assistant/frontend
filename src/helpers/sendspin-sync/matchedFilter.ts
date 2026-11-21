/**
 * Finding when a calibration chirp reached the microphone.
 *
 * The recording is cross-correlated against a locally generated copy of the
 * sweep. Correlating against a sweep rather than looking for an onset is what
 * makes this work in a real room: reverberation smears the start of a burst
 * beyond recognition, but a matched filter folds the whole 60 ms sweep back into
 * a pulse a fraction of a millisecond wide.
 *
 * Two choices here are load-bearing.
 *
 * The peak taken is the **first** one above threshold, never the tallest. A
 * reflection off a floor or a wall routinely arrives within a few milliseconds of
 * the direct sound and can be the louder of the two — a hard surface close by
 * beats a speaker pointed away from you. Taking the maximum would then measure
 * the reflected path and never say so.
 *
 * The peak is located on the analytic envelope rather than the raw correlation.
 * The raw correlation oscillates at the sweep's own frequencies, so its highest
 * ripple sits an unpredictable fraction of a cycle away from the true arrival;
 * the envelope has one smooth maximum, which is what makes interpolating between
 * samples meaningful.
 */

import { nextPowerOfTwo, transform } from "./fft";

/** One detected arrival, in samples from the start of the analysed signal. */
export interface ArrivalPeak {
  /** Where the direct arrival landed, refined to below a single sample. */
  sample: number;
  /** Envelope height at the direct arrival. */
  level: number;
  /**
   * Height of the tallest peak in the same span.
   *
   * Above `level` whenever a reflection came back louder than the direct sound,
   * which is exactly the case the first-peak rule exists for.
   */
  strongest: number;
  /** The direct arrival against the recording's own noise floor. */
  snr: number;
}

export interface ArrivalSearch {
  /** Envelope noise floor, measured once across the whole recording. */
  noiseFloor: number;
  /** First sample of the span to search. */
  from?: number;
  /** One past the last sample of the span to search. */
  to?: number;
}

/**
 * How far above the noise floor a peak must stand to be the arrival.
 *
 * Nothing can precede the direct sound, so what is being looked for is simply
 * the first thing in the span that rises out of the room — the threshold belongs
 * against the noise, not against the loudest reflection that happened to follow.
 */
const MIN_SNR = 6;

/**
 * A floor on the threshold, as a fraction of the tallest peak in the span.
 *
 * Only a guard against timing some tiny ripple ahead of the real arrival. It is
 * kept low deliberately: at 0.15 a direct sound 16 dB below its own reflection is
 * still taken first, which is what a phone held beside rather than in front of a
 * speaker produces.
 */
const PEAK_FRACTION = 0.15;

/**
 * Cross-correlate `signal` against `reference` and return the result's envelope.
 *
 * The returned envelope is indexed by the lag at which the reference starts
 * inside the signal, so a peak at index `n` means the chirp began at sample `n`.
 */
export function correlationEnvelope(
  signal: Float32Array,
  reference: Float32Array,
): Float32Array {
  const lags = signal.length - reference.length + 1;
  if (lags <= 0) return new Float32Array(0);

  // Padded past the sum of both lengths so the circular transform cannot fold
  // the tail of one onto the head of the other.
  const size = nextPowerOfTwo(signal.length + reference.length);
  const real = new Float64Array(size);
  const imag = new Float64Array(size);
  const referenceReal = new Float64Array(size);
  const referenceImag = new Float64Array(size);
  real.set(signal);
  referenceReal.set(reference);

  transform(real, imag);
  transform(referenceReal, referenceImag);

  for (let bin = 0; bin < size; bin++) {
    // Multiplying by the reference's conjugate correlates rather than convolves.
    const crossReal =
      real[bin] * referenceReal[bin] + imag[bin] * referenceImag[bin];
    const crossImag =
      imag[bin] * referenceReal[bin] - real[bin] * referenceImag[bin];

    // Discarding the negative frequencies makes the inverse transform the
    // analytic signal, whose magnitude is the envelope. Doubling what is kept
    // preserves the amplitude of the real part.
    const gain = bin === 0 || bin === size >> 1 ? 1 : bin < size >> 1 ? 2 : 0;
    real[bin] = crossReal * gain;
    imag[bin] = crossImag * gain;
  }

  transform(real, imag, true);

  const envelope = new Float32Array(lags);
  for (let lag = 0; lag < lags; lag++)
    envelope[lag] = Math.hypot(real[lag], imag[lag]);
  return envelope;
}

/**
 * The envelope's noise floor.
 *
 * A recording holds far more silence than chirp, so the median of the whole
 * envelope reads the room and ignores the arrivals standing out of it.
 */
export function noiseFloor(envelope: Float32Array): number {
  if (!envelope.length) return 0;
  const sorted = Float32Array.from(envelope).sort();
  return sorted[sorted.length >> 1];
}

/**
 * Locate the direct arrival inside a span of the envelope.
 *
 * Returns `null` when nothing in the span stands far enough out of the noise to
 * be a chirp at all, which is the honest answer for a speaker that was silent or
 * too distant.
 */
export function findFirstArrival(
  envelope: Float32Array,
  search: ArrivalSearch,
): ArrivalPeak | null {
  const from = Math.max(0, search.from ?? 0);
  const to = Math.min(envelope.length, search.to ?? envelope.length);
  if (to - from < 3) return null;

  let strongest = 0;
  for (let index = from; index < to; index++)
    if (envelope[index] > strongest) strongest = envelope[index];

  const floor = search.noiseFloor;
  if (strongest <= 0) return null;
  if (floor > 0 && strongest < MIN_SNR * floor) return null;

  const threshold = Math.max(PEAK_FRACTION * strongest, MIN_SNR * floor);
  let index = from;
  // A span whose first sample is already above threshold has cut into something
  // that began before it, and where that started cannot be recovered from here.
  // Skipping past it and taking the next rise costs one arrival; treating its
  // truncated flank as an arrival would cost a wrong measurement.
  while (index < to && envelope[index] >= threshold) index++;
  while (index < to && envelope[index] < threshold) index++;
  if (index >= to) return null;

  // The threshold is crossed on the peak's rising flank, so climb to its top
  // rather than timing the crossing, whose position moves with the level.
  while (index + 1 < to && envelope[index + 1] > envelope[index]) index++;
  if (index <= from || index + 1 >= to) return null;

  return {
    sample: index + interpolate(envelope, index),
    level: envelope[index],
    strongest,
    // A floor of zero cannot happen on live audio, but it must not become an
    // infinite confidence that then reads as the best possible reading.
    snr: floor > 0 ? envelope[index] / floor : 0,
  };
}

/**
 * Sub-sample position of a peak, from the parabola through it and its
 * neighbours.
 *
 * The envelope is sampled at 48 kHz, so a whole sample is already 20 µs; fitting
 * the curve takes the reading well below that and is what keeps the arrival time
 * honest to a fraction of a millisecond.
 */
function interpolate(envelope: Float32Array, index: number): number {
  const before = envelope[index - 1];
  const at = envelope[index];
  const after = envelope[index + 1];

  const curvature = before - 2 * at + after;
  if (curvature >= 0) return 0;

  const shift = (0.5 * (before - after)) / curvature;
  // A parabola through three samples cannot legitimately place the peak outside
  // the middle one; anything further means the neighbours were not a peak.
  return Math.abs(shift) <= 0.5 ? shift : 0;
}
