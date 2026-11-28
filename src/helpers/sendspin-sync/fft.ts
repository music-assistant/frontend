/**
 * Radix-2 fast Fourier transform, in place over split real and imaginary parts.
 *
 * This exists so the arrival detector can correlate a whole capture against the
 * reference chirp at full sample rate. Done directly that is a few thousand
 * multiplies per output sample and far too slow on a phone; through a transform
 * it is a handful of milliseconds, which is what makes searching the entire
 * recording — rather than a narrow guessed window — affordable.
 *
 * Deliberately the plainest implementation that does the job. Nothing here runs
 * on the audio thread.
 */

/** Round up to the transform length a correlation of this size needs. */
export function nextPowerOfTwo(value: number): number {
  let size = 1;
  while (size < value) size *= 2;
  return size;
}

/**
 * Transform `real`/`imag` in place; both must be the same power-of-two length.
 *
 * The inverse divides by the length, so a forward followed by an inverse returns
 * the input.
 */
export function transform(
  real: Float64Array,
  imag: Float64Array,
  inverse = false,
): void {
  const size = real.length;
  if (size <= 1) return;
  if (size !== imag.length || (size & (size - 1)) !== 0)
    throw new RangeError("FFT length must be a matching power of two");

  reorder(real, imag);

  for (let span = 2; span <= size; span <<= 1) {
    const half = span >> 1;
    const angle = ((inverse ? 2 : -2) * Math.PI) / span;
    const stepReal = Math.cos(angle);
    const stepImag = Math.sin(angle);

    for (let start = 0; start < size; start += span) {
      // The twiddle factor is stepped rather than recomputed per butterfly, and
      // reseeded every block so the error cannot accumulate across the stage.
      let factorReal = 1;
      let factorImag = 0;

      for (let offset = 0; offset < half; offset++) {
        const low = start + offset;
        const high = low + half;
        const oddReal = real[high] * factorReal - imag[high] * factorImag;
        const oddImag = real[high] * factorImag + imag[high] * factorReal;

        real[high] = real[low] - oddReal;
        imag[high] = imag[low] - oddImag;
        real[low] += oddReal;
        imag[low] += oddImag;

        const nextReal = factorReal * stepReal - factorImag * stepImag;
        factorImag = factorReal * stepImag + factorImag * stepReal;
        factorReal = nextReal;
      }
    }
  }

  if (!inverse) return;
  for (let index = 0; index < size; index++) {
    real[index] /= size;
    imag[index] /= size;
  }
}

/** Permute both halves into bit-reversed order, which the butterflies expect. */
function reorder(real: Float64Array, imag: Float64Array): void {
  const size = real.length;
  for (let index = 1, mirror = 0; index < size; index++) {
    let bit = size >> 1;
    for (; mirror & bit; bit >>= 1) mirror ^= bit;
    mirror ^= bit;
    if (index >= mirror) continue;

    [real[index], real[mirror]] = [real[mirror], real[index]];
    [imag[index], imag[mirror]] = [imag[mirror], imag[index]];
  }
}
