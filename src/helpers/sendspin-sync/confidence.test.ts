import { measurementConfidence } from "@/helpers/sendspin-sync/confidence";
import { describe, expect, it } from "vitest";

describe("measurementConfidence", () => {
  it("is good when nearly every chirp came through clearly", () => {
    expect(
      measurementConfidence({ found: 10, expected: 10, medianSnr: 40 }),
    ).toBe("good");
    expect(
      measurementConfidence({ found: 8, expected: 10, medianSnr: 12 }),
    ).toBe("good");
  });

  it("is only weak when the chirps were faint, however many arrived", () => {
    // Every chirp found, but each barely out of the room noise: the arrival times
    // are there and the sub-sample refinement on them is not worth much.
    expect(
      measurementConfidence({ found: 10, expected: 10, medianSnr: 7 }),
    ).toBe("weak");
  });

  it("is weak when a fair share of the chirps were missed", () => {
    expect(
      measurementConfidence({ found: 5, expected: 10, medianSnr: 40 }),
    ).toBe("weak");
  });

  it("is poor when most of the chirps never arrived", () => {
    expect(
      measurementConfidence({ found: 3, expected: 10, medianSnr: 40 }),
    ).toBe("poor");
  });

  it("is poor when the speaker was never heard at all", () => {
    expect(
      measurementConfidence({ found: 0, expected: 10, medianSnr: 0 }),
    ).toBe("poor");
    expect(measurementConfidence({ found: 0, expected: 0, medianSnr: 0 })).toBe(
      "poor",
    );
  });
});
