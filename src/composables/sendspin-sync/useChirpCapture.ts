/**
 * Owns the microphone for a whole calibration run.
 *
 * One `getUserMedia` stream and one `AudioContext`, opened on the first tap and
 * kept open until the run ends. Every arrival is timed against the frame counter
 * inside the capture worklet, and that counter only means anything while the
 * graph it belongs to stays up — reopening the microphone per speaker would leave
 * each recording on its own time base with nothing to relate them.
 *
 * Recording is armed and disarmed around each speaker, which is not the same
 * thing. The audio graph runs throughout and the frame counter never stops; all
 * disarming does is stop shipping samples to the main thread. Hearing nothing
 * while walking between rooms is expected and simply contributes no arrivals.
 *
 * A suspended context voids the run. There is no absolute anchor to recover
 * from: once the audio clock has stopped, arrivals recorded before the gap and
 * after it cannot be placed on one timeline, and the only honest response is to
 * say so and start again.
 */

import { onScopeDispose, ref } from "vue";
import {
  describeError,
  holdScreenAwake,
  openMicrophone,
  type ConstraintCheck,
  type ProbeContextState,
  type ProbeError,
  type ScreenAwake,
  type WakeLockCheck,
} from "./audioCapture";
// `no-inline` keeps the processor a real file: `addModule()` is not reliably
// allowed to load a `data:` URL, which is what Vite would otherwise emit for an
// asset this small.
import chirpCaptureUrl from "./chirpCaptureProcessor.js?url&no-inline";
import { CHIRP_END_HZ } from "@/helpers/sendspin-sync/chirp";

/** Why a run has to be thrown away rather than reported. */
export type CaptureVoid = "suspended";

export interface CaptureOpening {
  opened: boolean;
  sampleRate: number | null;
  constraints: ConstraintCheck | null;
  wakeLock: WakeLockCheck | null;
  error: ProbeError | null;
}

export interface Recording {
  samples: Float32Array;
  /** Frame index of the first sample, on the phone's audio clock. */
  firstFrame: number;
  sampleRate: number;
  /** Render quanta of this recording nothing was heard for. */
  dropouts: number;
  /**
   * How many frames those quanta cover, to read against `samples.length`.
   *
   * Reported separately from the count because only the worklet knows how long a
   * render quantum is here, and how much of a recording was lost is the figure
   * that decides whether its arrivals are readings at all.
   */
  lostFrames: number;
}

/** How often the render clock is checked against the system clock. */
const CLOCK_CHECK_MS = 1000;

/**
 * How far the render clock may fall behind the system clock between two checks,
 * in seconds.
 *
 * Compared per tick rather than cumulatively. A cumulative comparison is an
 * integral, so it cannot tell steady drift apart from a gap plus a little drift:
 * any allowance loose enough for ten minutes of a 1000 ppm clock is also loose
 * enough to hide a multi-second gap, and the allowance has to grow with the run
 * for exactly that reason. Per tick the two are separable — ordinary drift
 * contributes about a millisecond per second, whatever the run has done so far,
 * while a suspension contributes the whole gap at once.
 *
 * Both clocks are read at the same instant, so a late or throttled tick moves
 * them together and this stays immune to scheduling jitter.
 */
const CLOCK_LAG_SECONDS = 0.15;

/** How long past the requested length a recording waits before giving up. */
const RECORD_GRACE_MS = 2000;

/** One message from the capture worklet. */
export interface CaptureBatch {
  startFrame: number;
  dropouts: number;
  lostFrames: number;
  samples: Float32Array;
}

export function useChirpCapture() {
  const opened = ref(false);
  const recording = ref(false);
  const voided = ref<CaptureVoid | null>(null);
  const sampleRate = ref(0);
  /** Every context state the run passed through, newest last. */
  const contextStates = ref<ProbeContextState[]>([]);

  let context: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let capture: AudioWorkletNode | null = null;
  let sink: GainNode | null = null;
  let wakeLock: ScreenAwake | null = null;
  let watchdog: ReturnType<typeof setInterval> | null = null;
  let onStateChange: (() => void) | null = null;
  let baseline: { render: number; wall: number } | null = null;

  onScopeDispose(() => {
    void close();
  });

  /**
   * Open the microphone and build the capture graph.
   *
   * Must be called from a user gesture: the `AudioContext` is constructed before
   * the first `await` so Safari still counts the tap.
   */
  async function open(): Promise<CaptureOpening> {
    if (opened.value)
      return {
        opened: true,
        sampleRate: sampleRate.value,
        constraints: null,
        wakeLock: null,
        error: null,
      };

    if (typeof navigator.mediaDevices?.getUserMedia !== "function")
      return {
        opened: false,
        sampleRate: null,
        constraints: null,
        wakeLock: null,
        error: {
          name: "UnsupportedError",
          message: "This browser has no getUserMedia",
        },
      };

    try {
      context = new AudioContext();
    } catch (error) {
      // Safari caps how many contexts a page may hold, and refusing one is a
      // result worth reporting rather than an exception into a click handler.
      return {
        opened: false,
        sampleRate: null,
        constraints: null,
        wakeLock: null,
        error: describeError(error),
      };
    }

    wakeLock = await holdScreenAwake(window.isSecureContext);
    const captured = await openMicrophone();
    if (!captured.stream) {
      // Read before closing, which releases the lock and forgets the reading.
      const held = wakeLock?.check ?? null;
      await close();
      return {
        opened: false,
        sampleRate: null,
        constraints: captured.constraints,
        wakeLock: held,
        error: captured.constraints.error,
      };
    }
    stream = captured.stream;

    try {
      await context.resume();
      await context.audioWorklet.addModule(chirpCaptureUrl);

      source = context.createMediaStreamSource(stream);
      capture = new AudioWorkletNode(context, "sendspin-chirp-capture", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      // The worklet emits silence; the muted sink exists only to keep the graph
      // attached to the destination so the audio thread keeps pulling it.
      sink = context.createGain();
      sink.gain.value = 0;
      source.connect(capture).connect(sink).connect(context.destination);
    } catch (error) {
      const wakeLockCheck = wakeLock?.check ?? null;
      await close();
      return {
        opened: false,
        sampleRate: null,
        constraints: captured.constraints,
        wakeLock: wakeLockCheck,
        error: describeError(error),
      };
    }

    // The sweep runs to CHIRP_END_HZ, so a context sampling below twice that
    // cannot represent its top end and the correlation would be against a
    // waveform the microphone never heard. Reported rather than measured.
    if (context.sampleRate < 2 * CHIRP_END_HZ) {
      const rate = context.sampleRate;
      await close();
      return {
        opened: false,
        sampleRate: rate,
        constraints: captured.constraints,
        wakeLock: null,
        error: {
          name: "SampleRateError",
          message: `This browser captures at ${rate} Hz, too low for the calibration chirp`,
        },
      };
    }

    sampleRate.value = context.sampleRate;
    watchClock();
    document.addEventListener("visibilitychange", holdAwakeAgain);
    opened.value = true;
    return {
      opened: true,
      sampleRate: context.sampleRate,
      constraints: captured.constraints,
      wakeLock: wakeLock?.check ?? null,
      error: null,
    };
  }

  /**
   * Record roughly `seconds` of audio, or return `null` when it cannot.
   *
   * The graph is already running, so this only arms the worklet and collects
   * what it posts back.
   */
  async function record(seconds: number): Promise<Recording | null> {
    const node = capture;
    const rate = context?.sampleRate;
    if (!opened.value || !node || !rate) return null;
    if (recording.value || voided.value) return null;

    recording.value = true;
    const wanted = Math.ceil(seconds * rate);
    try {
      return await new Promise<Recording | null>((resolve) => {
        const batches: CaptureBatch[] = [];
        let collected = 0;
        let settled = false;

        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(deadline);
          // Detached before disarming, so the worklet's final partial batch is
          // dropped rather than queued: enough has already been collected, and
          // the port fires it at nobody.
          node.port.onmessage = null;
          node.port.postMessage({ armed: false });
          resolve(assemble(batches, rate));
        };

        node.port.onmessage = (event: MessageEvent<CaptureBatch>) => {
          batches.push(event.data);
          collected += event.data.samples.length;
          if (collected >= wanted) finish();
        };

        // A device that stops delivering must not hang the walk.
        const deadline = setTimeout(finish, seconds * 1000 + RECORD_GRACE_MS);
        node.port.postMessage({ armed: true });
      });
    } finally {
      recording.value = false;
    }
  }

  /** Clear the fault from a run that has been thrown away. */
  function reset(): void {
    voided.value = null;
    contextStates.value = [];
  }

  /**
   * Take the screen wake lock again once the page is back in view.
   *
   * A browser releases the lock whenever the page is hidden and never hands it
   * back by itself, so a glance at a notification would otherwise leave the rest
   * of the walk to the phone's own screen timeout.
   */
  function holdAwakeAgain(): void {
    if (document.visibilityState !== "visible" || !opened.value) return;
    if (wakeLock?.check?.heldToEnd) return;
    void holdScreenAwake(window.isSecureContext).then(async (held) => {
      if (!opened.value) return held.release();
      const previous = wakeLock;
      wakeLock = held;
      await previous?.release();
    });
  }

  /** Release the microphone, the graph and the wake lock. */
  async function close(): Promise<void> {
    document.removeEventListener("visibilitychange", holdAwakeAgain);
    if (watchdog !== null) {
      clearInterval(watchdog);
      watchdog = null;
    }
    if (context && onStateChange)
      context.removeEventListener("statechange", onStateChange);
    onStateChange = null;
    baseline = null;

    source?.disconnect();
    capture?.disconnect();
    capture?.port.close();
    sink?.disconnect();
    for (const track of stream?.getTracks() ?? []) track.stop();
    await context?.close().catch(() => undefined);
    await wakeLock?.release();

    context = null;
    stream = null;
    source = null;
    capture = null;
    sink = null;
    wakeLock = null;
    opened.value = false;
    recording.value = false;
  }

  /**
   * Watch for the context stopping, by both routes a browser offers.
   *
   * The state change is the direct signal and fires on the browsers that
   * implement it, including Safari's non-standard `interrupted`. Comparing the
   * render clock against the system clock catches the rest: a context that
   * quietly stops advancing has stopped, whatever it claims its state is.
   */
  function watchClock(): void {
    if (!context) return;
    const audio = context;

    baseline = { render: audio.currentTime, wall: performance.now() / 1000 };
    onStateChange = () => {
      const state = audio.state as ProbeContextState;
      contextStates.value = [...contextStates.value, state];
      if (state !== "running") voided.value = "suspended";
    };
    audio.addEventListener("statechange", onStateChange);

    watchdog = setInterval(() => {
      if (!baseline) return;
      const wall = performance.now() / 1000;
      const render = audio.currentTime;
      const lag = wall - baseline.wall - (render - baseline.render);
      baseline = { render, wall };
      // Only a render clock falling behind matters; it cannot run ahead of the
      // system clock by anything that is not ordinary jitter.
      if (lag > CLOCK_LAG_SECONDS) voided.value = "suspended";
    }, CLOCK_CHECK_MS);
  }

  return {
    opened,
    recording,
    voided,
    sampleRate,
    contextStates,
    open,
    record,
    reset,
    close,
  };
}

/**
 * Join the posted batches into one recording.
 *
 * Each batch is placed by its own frame index rather than appended, so a gap
 * between batches stays a gap of silence at the right length instead of pulling
 * every later sample earlier. Those indices come off the render clock, which is
 * what makes the gap the right length rather than merely a gap.
 *
 * Exported for the tests that drive the worklet's own output through the
 * measurement: this is the seam where frame indices become a timeline, and the
 * cheapest place to prove a dropped stretch keeps its width.
 */
export function assemble(
  batches: CaptureBatch[],
  sampleRate: number,
): Recording | null {
  if (!batches.length) return null;

  const firstFrame = batches[0].startFrame;
  const last = batches[batches.length - 1];
  const length = last.startFrame + last.samples.length - firstFrame;
  const samples = new Float32Array(length);
  for (const batch of batches)
    samples.set(batch.samples, batch.startFrame - firstFrame);

  // The tallies run from the moment the worklet was armed, so the last message
  // to arrive carries the whole recording's.
  return {
    samples,
    firstFrame,
    sampleRate,
    dropouts: last.dropouts,
    lostFrames: last.lostFrames,
  };
}
