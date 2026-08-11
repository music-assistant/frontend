/* global AudioWorkletProcessor, registerProcessor, currentTime */

/**
 * Audio worklet that counts what a microphone capture actually delivers.
 *
 * Emitted verbatim — Vite neither transpiles nor type-checks this file, and an
 * AudioWorkletGlobalScope has neither the DOM nor dependable static-import
 * support. Keep it plain, import-free JavaScript inside the syntax every
 * browser that ships AudioWorklet already understands.
 *
 * Each report pairs the running totals with the context's own clock so the main
 * thread can tell three unrelated faults apart: a render clock that does not
 * keep pace with the system clock, stretches the microphone filled with digital
 * silence, and a microphone that never produced any signal at all.
 */

/** One report per this many render quanta — roughly every 170 ms at 48 kHz. */
const REPORT_INTERVAL_QUANTA = 64;

class FrameCounterProcessor extends AudioWorkletProcessor {
  frames = 0;
  quanta = 0;
  silentQuanta = 0;
  unconnectedQuanta = 0;
  peak = 0;

  process(inputs) {
    const channel = inputs[0]?.[0];
    this.quanta += 1;
    if (channel) this.inspect(channel);
    // Only ever seen when the input has no live connection, so this staying at
    // zero is what confirms the graph was wired up the way it was meant to be.
    else this.unconnectedQuanta += 1;

    if (this.quanta % REPORT_INTERVAL_QUANTA === 0) this.report();
    return true;
  }

  /**
   * A dropout arrives as digital silence, not as a missing channel, and any
   * real room has a noise floor — so bit-exact zero is the signal to count.
   * The peak across the whole run is what proves the microphone heard anything.
   */
  inspect(channel) {
    this.frames += channel.length;

    let peak = 0;
    for (let i = 0; i < channel.length; i++) {
      const level = Math.abs(channel[i]);
      if (level > peak) peak = level;
    }
    if (peak === 0) this.silentQuanta += 1;
    if (peak > this.peak) this.peak = peak;
  }

  report() {
    this.port.postMessage({
      frames: this.frames,
      quanta: this.quanta,
      silentQuanta: this.silentQuanta,
      unconnectedQuanta: this.unconnectedQuanta,
      peak: this.peak,
      contextTime: currentTime,
    });
  }
}

registerProcessor("sendspin-frame-counter", FrameCounterProcessor);
