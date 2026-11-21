import { nextPowerOfTwo, transform } from "@/helpers/sendspin-sync/fft";
import { describe, expect, it } from "vitest";

/** Straight from the definition, to check the fast version against. */
function naiveDft(real: number[], imag: number[]): [number[], number[]] {
  const size = real.length;
  const outReal = Array.from({ length: size }, () => 0);
  const outImag = Array.from({ length: size }, () => 0);

  for (let bin = 0; bin < size; bin++)
    for (let index = 0; index < size; index++) {
      const angle = (-2 * Math.PI * bin * index) / size;
      outReal[bin] +=
        real[index] * Math.cos(angle) - imag[index] * Math.sin(angle);
      outImag[bin] +=
        real[index] * Math.sin(angle) + imag[index] * Math.cos(angle);
    }
  return [outReal, outImag];
}

/** Deterministic values, so a failure is always reproducible. */
function noise(seed: number, length: number): number[] {
  let state = seed;
  return Array.from({ length }, () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648 - 0.5;
  });
}

describe("nextPowerOfTwo", () => {
  it("rounds up, and leaves a power of two alone", () => {
    expect(nextPowerOfTwo(1)).toBe(1);
    expect(nextPowerOfTwo(3)).toBe(4);
    expect(nextPowerOfTwo(1024)).toBe(1024);
    expect(nextPowerOfTwo(1025)).toBe(2048);
  });
});

describe("transform", () => {
  it("agrees with the definition", () => {
    const real = noise(1, 64);
    const imag = noise(2, 64);
    const [expectedReal, expectedImag] = naiveDft(real, imag);

    const gotReal = Float64Array.from(real);
    const gotImag = Float64Array.from(imag);
    transform(gotReal, gotImag);

    for (let bin = 0; bin < 64; bin++) {
      expect(gotReal[bin]).toBeCloseTo(expectedReal[bin], 9);
      expect(gotImag[bin]).toBeCloseTo(expectedImag[bin], 9);
    }
  });

  it("returns the input after a round trip, even at a length the detector uses", () => {
    const original = noise(3, 65536);
    const real = Float64Array.from(original);
    const imag = new Float64Array(65536);

    transform(real, imag);
    transform(real, imag, true);

    for (let index = 0; index < original.length; index++) {
      expect(real[index]).toBeCloseTo(original[index], 9);
      expect(imag[index]).toBeCloseTo(0, 9);
    }
  });

  it("puts a pure tone in exactly one bin", () => {
    const size = 256;
    const real = new Float64Array(size);
    const imag = new Float64Array(size);
    for (let index = 0; index < size; index++)
      real[index] = Math.cos((2 * Math.PI * 8 * index) / size);

    transform(real, imag);

    const magnitudes = Array.from({ length: size }, (_, bin) =>
      Math.hypot(real[bin], imag[bin]),
    );
    expect(magnitudes[8]).toBeCloseTo(size / 2, 6);
    expect(magnitudes[size - 8]).toBeCloseTo(size / 2, 6);
    for (const bin of [0, 1, 7, 9, 128])
      expect(magnitudes[bin]).toBeLessThan(1e-9);
  });

  it("refuses a length it cannot transform", () => {
    expect(() => transform(new Float64Array(3), new Float64Array(3))).toThrow(
      RangeError,
    );
    expect(() => transform(new Float64Array(4), new Float64Array(8))).toThrow(
      RangeError,
    );
  });
});
