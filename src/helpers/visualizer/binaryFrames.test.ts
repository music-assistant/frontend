import { describe, expect, it } from "vitest";
import { parseVisualizerBinary } from "./binaryFrames";

function makeFrame(
  frameType: number,
  timestampUs: bigint,
  payload: number[],
): ArrayBuffer {
  const buffer = new ArrayBuffer(9 + payload.length);
  const view = new DataView(buffer);
  view.setUint8(0, frameType);
  view.setBigInt64(1, timestampUs, false);
  new Uint8Array(buffer, 9).set(payload);
  return buffer;
}

describe("parseVisualizerBinary", () => {
  it("parses a waveform frame", () => {
    const samples = [0, 64, 128, 192];
    const frame = parseVisualizerBinary(makeFrame(22, 1_234_000n, samples), 4);
    expect(frame).not.toBeNull();
    expect(frame!.kind).toBe("waveform");
    expect(frame!.timestampUs).toBe(1_234_000);
    if (frame!.kind === "waveform") {
      expect(Array.from(frame!.samples)).toEqual(samples);
    }
  });

  it("handles timestamps beyond 2^31", () => {
    const bigTs = 4_599_411_068_751n;
    const frame = parseVisualizerBinary(makeFrame(22, bigTs, [128, 128]), 2);
    expect(frame!.timestampUs).toBe(Number(bigTs));
  });

  it("rejects waveform frames with wrong sample count", () => {
    expect(
      parseVisualizerBinary(makeFrame(22, 0n, [128, 128, 128]), 4),
    ).toBeNull();
  });

  it("parses beat frames with downbeat flag", () => {
    const downbeat = parseVisualizerBinary(makeFrame(17, 500n, [1]), 4);
    expect(downbeat).toMatchObject({
      kind: "beat",
      timestampUs: 500,
      isDownbeat: true,
    });
    const regular = parseVisualizerBinary(makeFrame(17, 501n, [0]), 4);
    expect(regular).toMatchObject({ kind: "beat", isDownbeat: false });
  });

  it("rejects beat frames with wrong payload length", () => {
    expect(parseVisualizerBinary(makeFrame(17, 0n, [1, 2]), 4)).toBeNull();
  });

  it("rejects unknown frame types and truncated headers", () => {
    expect(parseVisualizerBinary(makeFrame(99, 0n, [1]), 4)).toBeNull();
    expect(parseVisualizerBinary(new ArrayBuffer(4), 4)).toBeNull();
  });
});
