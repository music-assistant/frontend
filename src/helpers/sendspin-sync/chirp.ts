/**
 * The calibration chirp the server plays, regenerated locally.
 *
 * These constants and the phase formula mirror the server's
 * `sendspin_sync/chirp.py`. They have to agree exactly: the reference built here
 * is the matched filter the arrival detector correlates a recording against, and
 * a sweep that differs from the transmitted one broadens the correlation peak
 * instead of compressing it.
 *
 * Everything is expressed in seconds rather than frames, because the phone's
 * capture runs at whatever rate its `AudioContext` chose and not necessarily the
 * server's 48 kHz.
 */

/**
 * Seconds between the start of one chirp and the next.
 *
 * Shared with the server by hand rather than negotiated, and half of it is the
 * window within which two speakers can be told apart — so it is the one constant
 * here that both sides have to be rebuilt together to change. This page ships
 * with the server, so the two cannot disagree on it.
 */
export const CHIRP_PERIOD_SECONDS = 1;

/** Length of the sweep itself. */
export const CHIRP_SECONDS = 0.06;

export const CHIRP_START_HZ = 500;
export const CHIRP_END_HZ = 8000;

const SWEEP_RATIO_LOG = Math.log(CHIRP_END_HZ / CHIRP_START_HZ);

/**
 * Return the sweep's instantaneous phase in radians, `progress` running 0 to 1
 * across the chirp.
 *
 * The frequency rises logarithmically from {@link CHIRP_START_HZ} at 0 to
 * {@link CHIRP_END_HZ} at 1.
 */
export function chirpPhase(progress: number): number {
  const scale =
    (2 * Math.PI * CHIRP_START_HZ * CHIRP_SECONDS) / SWEEP_RATIO_LOG;
  return scale * (Math.exp(progress * SWEEP_RATIO_LOG) - 1);
}

/**
 * Build the matched-filter reference for a capture running at `sampleRate`.
 *
 * Carries the same Hann window as the transmitted chirp, and is scaled to unit
 * energy so a correlation peak means the same thing whatever rate the browser
 * handed back.
 */
export function buildReferenceChirp(sampleRate: number): Float32Array {
  const length = Math.round(CHIRP_SECONDS * sampleRate);
  const reference = new Float32Array(length);

  let energy = 0;
  for (let frame = 0; frame < length; frame++) {
    const progress = frame / length;
    const window = 0.5 * (1 - Math.cos(2 * Math.PI * progress));
    const value = window * Math.sin(chirpPhase(progress));
    reference[frame] = value;
    energy += value * value;
  }

  const scale = energy > 0 ? 1 / Math.sqrt(energy) : 0;
  for (let frame = 0; frame < length; frame++) reference[frame] *= scale;
  return reference;
}
