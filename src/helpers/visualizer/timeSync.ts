/**
 * NTP-style clock sync against the MA visualizer relay (server clock domain).
 *
 * Each ping yields (t1 client send, t2 server receive, t3 server send,
 * t4 client receive); the offset of the lowest-delay sample in a sliding
 * window is the best estimate of `serverNow - clientNow`.
 */

export interface TimeSyncSample {
  offsetUs: number;
  delayUs: number;
}

/**
 * Compute one sync sample from the four NTP timestamps (all µs).
 */
export function computeTimeSample(
  t1: number,
  t2: number,
  t3: number,
  t4: number,
): TimeSyncSample {
  return {
    offsetUs: (t2 - t1 + (t3 - t4)) / 2,
    delayUs: (t4 - t1 - (t3 - t2)) / 2,
  };
}

export class ClockSync {
  private samples: TimeSyncSample[] = [];

  constructor(private readonly windowSize = 40) {}

  get synchronized(): boolean {
    return this.samples.length > 0;
  }

  addSample(sample: TimeSyncSample): void {
    this.samples.push(sample);
    if (this.samples.length > this.windowSize) this.samples.shift();
  }

  /**
   * Best current clock offset (µs to add to client time), or null before
   * the first sample.
   */
  get offsetUs(): number | null {
    if (this.samples.length === 0) return null;
    return this.samples.reduce((best, sample) =>
      sample.delayUs < best.delayUs ? sample : best,
    ).offsetUs;
  }

  clear(): void {
    this.samples = [];
  }
}
