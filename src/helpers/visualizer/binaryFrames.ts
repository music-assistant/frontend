/**
 * Parsers for the MA visualizer relay's binary frames.
 *
 * Wire layout (big-endian): [type:1][timestamp:8 int64 µs][payload]
 * - type 22: waveform — nSamples × uint8 offset-binary samples (0x80 = zero)
 * - type 17: beat — 1 flags byte, bit0 = downbeat
 */

export const WAVEFORM_FRAME_TYPE = 22;
export const BEAT_FRAME_TYPE = 17;

export interface WaveformFrame {
  kind: "waveform";
  timestampUs: number;
  samples: Uint8Array;
}

export interface BeatFrame {
  kind: "beat";
  timestampUs: number;
  isDownbeat: boolean;
}

export type VisualizerBinaryFrame = WaveformFrame | BeatFrame;

const HEADER_BYTES = 9;

/**
 * Parse one relay binary message. Returns null for malformed or unknown frames.
 */
export function parseVisualizerBinary(
  buffer: ArrayBuffer,
  nSamples: number,
): VisualizerBinaryFrame | null {
  if (buffer.byteLength < HEADER_BYTES) return null;
  const view = new DataView(buffer);
  const frameType = view.getUint8(0);
  // int64 µs timestamps stay far below Number.MAX_SAFE_INTEGER in practice
  const timestampUs = Number(view.getBigInt64(1, false));

  if (frameType === WAVEFORM_FRAME_TYPE) {
    if (buffer.byteLength !== HEADER_BYTES + nSamples) return null;
    return {
      kind: "waveform",
      timestampUs,
      samples: new Uint8Array(buffer, HEADER_BYTES),
    };
  }
  if (frameType === BEAT_FRAME_TYPE) {
    if (buffer.byteLength !== HEADER_BYTES + 1) return null;
    return {
      kind: "beat",
      timestampUs,
      isDownbeat: (view.getUint8(HEADER_BYTES) & 1) === 1,
    };
  }
  return null;
}
