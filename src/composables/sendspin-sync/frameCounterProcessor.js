/* global AudioWorkletProcessor, registerProcessor, currentTime */

/**
 * Audio worklet that counts what a microphone capture actually delivers.
 *
 * Emitted verbatim — Vite neither transpiles nor type-checks this file, and an
 * AudioWorkletGlobalScope has neither the DOM nor dependable static-import
 * support. Keep it plain, import-free JavaScript inside the syntax every
 * browser that ships AudioWorklet already understands.
 *
 * Each report pairs the running totals with the context's own clock, which is
 * what lets the main thread weigh the audio pipeline against the system clock
 * and tell a drifting clock apart from audio that never arrived.
 */

/** One report per this many render quanta — roughly every 170 ms at 48 kHz. */
const REPORT_INTERVAL_QUANTA = 64;

class FrameCounterProcessor extends AudioWorkletProcessor {
  frames = 0;
  quanta = 0;
  leadInQuanta = 0;
  droppedQuanta = 0;
  unconnectedQuanta = 0;
  peak = 0;

  process(inputs) {
    const channel = inputs[0]?.[0];
    this.quanta += 1;
    if (channel?.length) this.inspect(channel);
    // Only ever seen when the input has no live connection, so this staying at
    // zero is what confirms the graph was wired up the way it was meant to be.
    else this.unconnectedQuanta += 1;

    if (this.quanta % REPORT_INTERVAL_QUANTA === 0) this.report();
    return true;
  }

  /**
   * A dropout arrives as digital silence rather than as a missing channel, and
   * a live converter's noise floor is never bit-exact zero — so once anything
   * has arrived, a silent quantum is a real gap. Before that it is the capture
   * device still warming up, which phones do routinely and which must not read
   * as a fault. The peak across the run is what proves the microphone heard
   * anything at all.
   */
  inspect(channel) {
    this.frames += channel.length;

    let peak = 0;
    for (let i = 0; i < channel.length; i++) {
      const level = Math.abs(channel[i]);
      if (level > peak) peak = level;
    }
    if (peak > this.peak) this.peak = peak;
    if (peak !== 0) return;

    if (this.peak === 0) this.leadInQuanta += 1;
    else this.droppedQuanta += 1;
  }

  report() {
    this.port.postMessage({
      frames: this.frames,
      quanta: this.quanta,
      leadInQuanta: this.leadInQuanta,
      droppedQuanta: this.droppedQuanta,
      unconnectedQuanta: this.unconnectedQuanta,
      peak: this.peak,
      contextTime: currentTime,
    });
  }
}

registerProcessor("sendspin-frame-counter", FrameCounterProcessor);
