/**
 * Buffers timestamped waveform frames and releases the one matching a given
 * server-clock instant. Frames arrive ahead of the audible playhead; the
 * render loop asks "which frame belongs to now" every animation tick.
 */

export interface ScheduledFrame {
  timestampUs: number;
  samples: Uint8Array;
}

export class FrameScheduler {
  private frames: ScheduledFrame[] = [];

  // Frames arrive stamped with future play-at times, up to the audio
  // pipeline's full production lead ahead of the audible playhead (tens of
  // seconds for buffered players). The buffer must hold that entire lead or
  // near-playhead frames get evicted and the visualizer starves until the
  // playhead catches up. ~4096 frames ≈ 100 s at 40 fps ≈ 4 MB.
  constructor(private readonly capacity = 4096) {}

  get size(): number {
    return this.frames.length;
  }

  get newestTimestampUs(): number | null {
    return this.frames.length
      ? this.frames[this.frames.length - 1].timestampUs
      : null;
  }

  /**
   * Add a frame. Frames are expected in roughly ascending timestamp order;
   * out-of-order arrivals are inserted at the right position. Oldest frames
   * are dropped when the buffer exceeds capacity.
   */
  push(frame: ScheduledFrame): void {
    const last = this.frames[this.frames.length - 1];
    if (last && frame.timestampUs < last.timestampUs) {
      const index = this.frames.findIndex(
        (f) => f.timestampUs > frame.timestampUs,
      );
      this.frames.splice(index === -1 ? this.frames.length : index, 0, frame);
    } else {
      this.frames.push(frame);
    }
    if (this.frames.length > this.capacity) {
      this.frames.splice(0, this.frames.length - this.capacity);
    }
  }

  /**
   * Return the newest frame at or before `serverNowUs` and drop everything
   * older than it. Returns null when no frame is due yet.
   */
  pickAt(serverNowUs: number): ScheduledFrame | null {
    let picked: ScheduledFrame | null = null;
    let index = 0;
    while (
      index < this.frames.length &&
      this.frames[index].timestampUs <= serverNowUs
    ) {
      picked = this.frames[index];
      index += 1;
    }
    if (index > 1) this.frames.splice(0, index - 1);
    return picked;
  }

  clear(): void {
    this.frames = [];
  }
}
