import { describe, expect, it } from "vitest";
import { createSyntheticFrameSource } from "./syntheticWaveform";

const FRAME_LENGTH = 1024;
const ZERO_LEVEL = 0x80;

describe("createSyntheticFrameSource", () => {
  it("yields full unsigned-byte frames that move around the zero level", () => {
    const frame = createSyntheticFrameSource()();
    expect(frame).toHaveLength(FRAME_LENGTH);
    expect(frame.some((sample) => sample !== ZERO_LEVEL)).toBe(true);
  });
});
