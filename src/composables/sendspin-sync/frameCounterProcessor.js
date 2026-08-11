/* global AudioWorkletProcessor, registerProcessor, currentFrame, currentTime */

/**
 * Audio worklet that counts the frames a microphone capture actually delivers.
 *
 * Stays plain JavaScript with no imports: Vite emits this file verbatim for
 * `audioWorklet.addModule()`, and an AudioWorkletGlobalScope has neither the
 * DOM nor dependable static-import support.
 */

/** One report per this many render quanta — roughly every 170 ms at 48 kHz. */
const REPORT_INTERVAL_QUANTA = 64;

/** Frames in a render quantum; used when the input hands back no channel. */
const RENDER_QUANTUM_FRAMES = 128;

class FrameCounterProcessor extends AudioWorkletProcessor {
  frames = 0;
  quanta = 0;
  nextExpectedFrame = null;
  gaps = [];

  process(inputs) {
    const channel = inputs[0]?.[0];
    this.frames += channel?.length ?? 0;
    this.quanta += 1;

    // The context clock keeps running even when the audio thread misses its
    // deadline, so a jump beyond one quantum is a stretch that never rendered.
    if (
      this.nextExpectedFrame !== null &&
      currentFrame > this.nextExpectedFrame
    )
      this.gaps.push({
        atFrame: currentFrame,
        missingFrames: currentFrame - this.nextExpectedFrame,
      });
    this.nextExpectedFrame =
      currentFrame + (channel?.length ?? RENDER_QUANTUM_FRAMES);

    if (this.quanta % REPORT_INTERVAL_QUANTA === 0) this.report();
    return true;
  }

  report() {
    this.port.postMessage({
      frames: this.frames,
      quanta: this.quanta,
      contextTime: currentTime,
      gaps: this.gaps,
    });
    this.gaps = [];
  }
}

registerProcessor("sendspin-frame-counter", FrameCounterProcessor);
