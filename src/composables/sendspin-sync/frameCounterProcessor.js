/* global AudioWorkletProcessor, registerProcessor, currentTime */

/**
 * Audio worklet that counts the frames a microphone capture actually delivers.
 *
 * Emitted verbatim — Vite neither transpiles nor type-checks this file, and an
 * AudioWorkletGlobalScope has neither the DOM nor dependable static-import
 * support. Keep it plain, import-free JavaScript inside the syntax every
 * browser that ships AudioWorklet already understands.
 *
 * Each report pairs the running totals with the context's own clock so the main
 * thread can separate two unrelated faults: frames the input never delivered
 * (totals against the render clock) and a render clock that does not keep pace
 * with the system clock (its clock against `performance.now()`).
 */

/** One report per this many render quanta — roughly every 170 ms at 48 kHz. */
const REPORT_INTERVAL_QUANTA = 64;

class FrameCounterProcessor extends AudioWorkletProcessor {
  frames = 0;
  quanta = 0;
  silentQuanta = 0;

  process(inputs) {
    const channel = inputs[0]?.[0];
    // A quantum the device supplied nothing for arrives as an empty input
    // rather than as silence, and counting those keeps a dropout visible.
    if (channel) this.frames += channel.length;
    else this.silentQuanta += 1;
    this.quanta += 1;

    if (this.quanta % REPORT_INTERVAL_QUANTA === 0) this.report();
    return true;
  }

  report() {
    this.port.postMessage({
      frames: this.frames,
      quanta: this.quanta,
      silentQuanta: this.silentQuanta,
      contextTime: currentTime,
    });
  }
}

registerProcessor("sendspin-frame-counter", FrameCounterProcessor);
