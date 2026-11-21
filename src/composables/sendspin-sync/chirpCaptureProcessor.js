/* global AudioWorkletProcessor, registerProcessor */

/**
 * Audio worklet that hands microphone samples to the main thread in batches.
 *
 * Emitted verbatim — Vite neither transpiles nor type-checks this file, and an
 * AudioWorkletGlobalScope has neither the DOM nor dependable static-import
 * support. Keep it plain, import-free JavaScript inside the syntax every browser
 * that ships AudioWorklet already understands.
 *
 * All this does is buffer and post. Correlating a recording against the
 * reference chirp is thousands of operations per sample, and the audio thread has
 * a hard deadline every render quantum: anything heavy in `process` is dropped
 * audio, so the analysis belongs on the main thread and stays there.
 *
 * Three properties are load-bearing for the measurement that consumes this.
 *
 * Batches are numbered on the render clock, which runs from the moment the graph
 * is built and is never reset, not even by disarming. It is the phone's audio
 * clock, and every arrival is timed against it — a counter that restarted per
 * recording would leave the separate recordings with no common time base at all.
 *
 * And it is the *render* clock rather than a tally of the frames that arrived.
 * The two agree only while nothing is missed, and what goes missing is exactly
 * what has to stay visible: a tally closes up every hole it passes through, so
 * one stalled stretch during a long walk upstairs times every arrival after it
 * early by the length of the stall, and the compression accumulates over the run
 * until a burst is numbered onto the wrong chirp. Numbered against the render
 * clock a hole keeps its true length, and the arrivals either side of it stay
 * where they happened.
 *
 * A render quantum the input supplied nothing for still contributes its frames,
 * as silence. It is the same hole seen from the other side — the quantum ran and
 * had nothing to hand over — and dropping those frames rather than filling them
 * would close it up just as a tally would.
 */

/** Frames per message — about 85 ms at 48 kHz, so a few messages per chirp. */
const BATCH_FRAMES = 4096;

/**
 * Where the render clock has reached, falling back to `counted` frames.
 *
 * `currentFrame` is maintained by the engine and advances every render quantum,
 * including the ones `process` is never called for — which is the only way those
 * can be seen from in here at all. A scope that does not expose it leaves the
 * accumulated count standing in: that is exact for a quantum that ran and was
 * handed nothing, and blind to one that never ran, which is the same blindness
 * this file had before and no worse.
 */
function renderFrame(counted) {
  return typeof currentFrame === "number" ? currentFrame : counted;
}

class ChirpCaptureProcessor extends AudioWorkletProcessor {
  /** Where the render clock is due at the next call. */
  due = 0;
  armed = false;
  batch = null;
  filled = 0;
  batchStart = 0;
  dropouts = 0;
  lostFrames = 0;

  constructor() {
    super();
    this.port.onmessage = (event) => {
      const armed = Boolean(event.data && event.data.armed);
      if (armed === this.armed) return;
      if (armed) this.arm();
      else this.disarm();
    };
  }

  process(inputs, outputs) {
    // Taken from the output because a missing input has no length to read, and
    // the clock has to be read either way.
    const quantum = outputs[0][0].length;
    const frame = renderFrame(this.due);
    // Render quanta that went by without this being called at all: the audio
    // thread missed them, and nothing was heard for their whole length.
    const skipped = frame - this.due;
    this.due = frame + quantum;

    if (this.armed) {
      // Only while armed. A stall between two speakers costs the measurement
      // nothing — the clock accounts for it and no chirp was being listened for
      // — so it is not a fault to report.
      if (skipped > 0) this.reopen(frame, skipped, quantum);
      this.append(inputs[0] && inputs[0][0], quantum);
    }
    return true;
  }

  arm() {
    this.armed = true;
    this.dropouts = 0;
    this.lostFrames = 0;
    this.batch = new Float32Array(BATCH_FRAMES);
    this.filled = 0;
    // Armed between two render quanta, so recording starts where the clock is
    // next due. `renderFrame` covers arming before the graph has rendered at
    // all, which is the one moment nothing has set `due` yet.
    this.batchStart = Math.max(this.due, renderFrame(this.due));
    this.due = this.batchStart;
  }

  disarm() {
    this.flush();
    this.armed = false;
    this.batch = null;
  }

  /**
   * Break the batch around frames that were never rendered.
   *
   * The samples either side go out as separate batches, each numbered where the
   * clock says it starts, and joining them back up leaves the hole between them
   * at its true length. Filling it with silence here would work equally well and
   * cost a copy of however long the stall was.
   *
   * Counted before the flush rather than after, so the batch this posts already
   * carries the loss: the tallies are cumulative and the main thread reads the
   * last message it received, which on a recording that ends mid-batch is this
   * one.
   */
  reopen(frame, skipped, quantum) {
    this.dropouts += Math.round(skipped / quantum);
    this.lostFrames += skipped;
    this.flush();
    this.batchStart = frame;
  }

  /** Copy one quantum into the batch, posting whenever the batch fills. */
  append(channel, quantum) {
    if (!channel) {
      this.dropouts += 1;
      this.lostFrames += quantum;
    }

    let written = 0;
    while (written < quantum) {
      const take = Math.min(this.batch.length - this.filled, quantum - written);
      if (channel)
        this.batch.set(channel.subarray(written, written + take), this.filled);
      else this.batch.fill(0, this.filled, this.filled + take);

      this.filled += take;
      written += take;
      if (this.filled === this.batch.length) this.flush();
    }
  }

  flush() {
    if (!this.batch || this.filled === 0) return;

    const samples =
      this.filled === this.batch.length
        ? this.batch
        : this.batch.slice(0, this.filled);
    this.port.postMessage(
      {
        startFrame: this.batchStart,
        dropouts: this.dropouts,
        lostFrames: this.lostFrames,
        samples,
      },
      [samples.buffer],
    );

    this.batchStart += this.filled;
    this.filled = 0;
    // The posted buffer was transferred away, so it cannot be reused.
    this.batch = new Float32Array(BATCH_FRAMES);
  }
}

registerProcessor("sendspin-chirp-capture", ChirpCaptureProcessor);
