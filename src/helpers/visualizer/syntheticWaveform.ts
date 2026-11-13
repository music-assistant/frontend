/**
 * Synthetic 120 BPM "track" driving the preset previews: kick + bass line,
 * offbeat snares, eighth-note hats, a stepping chord and a slow energy swell,
 * so bass/mid/treble-reactive presets all react without a live audio source.
 */

const N_SAMPLES = 1024;
const SAMPLE_RATE = 44100;
const ZERO_LEVEL = 0x80;
const BPM = 120;
const BEATS_PER_SECOND = BPM / 60;

// A1, A1, C2, G1: one bass note per beat of the bar.
const BASS_NOTES = [55, 55, 65.41, 49];
// A3, F3, G3, D3: the chord root steps every two bars.
const CHORD_ROOTS = [220, 174.61, 196, 146.83];

export function createSyntheticFrameSource(): () => Uint8Array {
  const frame = new Uint8Array(N_SAMPLES);
  const epoch = performance.now();
  return () => {
    const now = (performance.now() - epoch) / 1000;
    for (let i = 0; i < N_SAMPLES; i++) {
      const t = now + i / SAMPLE_RATE;
      const beat = t * BEATS_PER_SECOND;
      const beatFrac = beat % 1;
      const beatInBar = Math.floor(beat) % 4;

      const kickEnv = Math.exp(-beatFrac * 5) * (beatInBar === 0 ? 1 : 0.8);
      const bass =
        0.55 * kickEnv * Math.sin(2 * Math.PI * BASS_NOTES[beatInBar] * t);
      const snare =
        beatInBar % 2 === 1
          ? 0.3 * Math.exp(-beatFrac * 10) * (Math.random() * 2 - 1)
          : 0;
      const hatFrac = (beat * 2) % 1;
      const hats = 0.12 * Math.exp(-hatFrac * 40) * (Math.random() * 2 - 1);
      const chordRoot = CHORD_ROOTS[Math.floor(beat / 8) % CHORD_ROOTS.length];
      const tremolo = 0.8 + 0.2 * Math.sin(2 * Math.PI * 1.5 * t);
      const mid =
        0.18 *
        tremolo *
        (Math.sin(2 * Math.PI * chordRoot * t) +
          0.7 * Math.sin(2 * Math.PI * chordRoot * 1.5 * t));
      const treb =
        0.1 *
        (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.9 * t)) *
        Math.sin(2 * Math.PI * 1760 * t);

      // Swell mids/trebs only; the kick keeps beat-reactive presets pumping.
      const energy = 0.75 + 0.25 * Math.sin((2 * Math.PI * t) / 24);
      const v =
        bass +
        snare +
        hats +
        energy * (mid + treb) +
        0.03 * (Math.random() * 2 - 1);
      frame[i] = ZERO_LEVEL + Math.max(-127, Math.min(127, Math.round(v * 96)));
    }
    return frame;
  };
}
