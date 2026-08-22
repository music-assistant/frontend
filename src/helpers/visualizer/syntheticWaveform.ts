/**
 * Synthetic stand-in waveform for the preset hover preview: a steady
 * 120 BPM kick with some mid/high content on top, so presets show their
 * character without a live audio feed. The engine only sees the getFrame
 * callback, so the relay's real waveform can replace this source later
 * without touching the preview itself.
 */

const N_SAMPLES = 1024;
const SAMPLE_RATE = 44100;
const ZERO_LEVEL = 0x80;

export function createSyntheticFrameSource(): () => Uint8Array {
  const frame = new Uint8Array(N_SAMPLES);
  const epoch = performance.now();
  return () => {
    const now = (performance.now() - epoch) / 1000;
    for (let i = 0; i < N_SAMPLES; i++) {
      const t = now + i / SAMPLE_RATE;
      // Kick: 55 Hz burst with a sharp per-sample decay, twice a second.
      const beat = Math.exp(-((t * 2) % 1) * 5);
      const bass = 0.6 * beat * Math.sin(2 * Math.PI * 55 * t);
      // Slowly wandering mid tone plus a pulsing high shimmer, so the
      // spectrum keeps moving and treble-reactive presets get something too.
      const mid =
        0.25 *
        Math.sin(2 * Math.PI * 220 * t + 2 * Math.sin(2 * Math.PI * 0.25 * t));
      const treb =
        0.15 *
        (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.9 * t)) *
        Math.sin(2 * Math.PI * 1760 * t);
      const v = bass + mid + treb + 0.04 * (Math.random() * 2 - 1);
      frame[i] = ZERO_LEVEL + Math.max(-127, Math.min(127, Math.round(v * 96)));
    }
    return frame;
  };
}
