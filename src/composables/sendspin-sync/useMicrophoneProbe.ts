/**
 * Probes whether this browser can capture microphone audio well enough to time
 * a Sendspin calibration chirp.
 *
 * Calibration measures when a chirp reaches the phone's microphone, which only
 * works if the browser hands back raw, continuously clocked samples. Every
 * check reports what the browser actually did rather than what was asked for,
 * and a failing check never stops the ones after it — the point is to collect
 * the whole picture in a single run. Checks that could not be reached stay
 * `null` so a report never claims a failure it did not observe.
 */

import { computed, onScopeDispose, ref } from "vue";
// `no-inline` keeps the processor a real file: `addModule()` is not reliably
// allowed to load a `data:` URL, which is what Vite would otherwise emit for
// an asset this small.
import frameCounterUrl from "./frameCounterProcessor.js?url&no-inline";

/** How long the continuity capture runs, in seconds. */
export const CAPTURE_SECONDS = 30;

const PROGRESS_INTERVAL_MS = 250;

/**
 * Drift beyond this is flagged.
 *
 * Consumer audio crystals sit inside ±100 ppm, so a tenth of a percent is far
 * outside anything a healthy clock produces.
 */
const DRIFT_WARN_PPM = 1000;

/** The voice processing a calibration capture needs switched off. */
export const VOICE_PROCESSING = [
  "echoCancellation",
  "noiseSuppression",
  "autoGainControl",
] as const;

export type VoiceProcessing = (typeof VOICE_PROCESSING)[number];

/** Posted by the frame counter worklet every few render quanta. */
interface FrameCounterReport {
  frames: number;
  quanta: number;
  silentQuanta: number;
  contextTime: number;
}

/** One worklet report, stamped with the main thread's clock on arrival. */
interface CaptureSample extends FrameCounterReport {
  at: number;
}

/** A failure kept whole: the name is what tells the reader which one it was. */
export interface ProbeError {
  name: string;
  message: string;
}

export interface SecureContextCheck {
  secure: boolean;
  origin: string;
  protocol: string;
}

export interface MediaApiCheck {
  mediaDevices: boolean;
  getUserMedia: boolean;
}

export interface ConstraintCheck {
  /** What the capture asked for — `false` for each voice processor. */
  requested: Record<VoiceProcessing, boolean>;
  /** What the track reports back; a missing entry means the browser said nothing. */
  applied: Partial<Record<VoiceProcessing, boolean>>;
  /** Whether the browser recognises each constraint at all. */
  supported: Record<VoiceProcessing, boolean>;
  /** True only when all three read back as explicitly off. */
  honored: boolean;
  trackSettings: MediaTrackSettings;
  trackLabel: string;
  error: ProbeError | null;
}

export interface AudioContextCheck {
  sampleRate: number;
  baseLatency: number | null;
  outputLatency: number | null;
}

export interface CaptureCheck {
  requestedSeconds: number;
  /** Wall-clock seconds between the first and last worklet report. */
  measuredSeconds: number;
  /** Seconds the context's own render clock advanced over the same span. */
  renderSeconds: number;
  framesDelivered: number;
  /** What the render clock says should have arrived over `renderSeconds`. */
  expectedFrames: number;
  /**
   * Delivered frames against expected, in parts per million.
   *
   * Both terms come off the audio thread, so no main-thread jitter enters this.
   */
  frameDiscrepancyPpm: number;
  /** Render quanta the input handed back no channel at all. */
  silentQuanta: number;
  quanta: number;
  /** The render clock against the system clock, in parts per million. */
  clockDriftPpm: number;
  error: ProbeError | null;
}

export interface WakeLockCheck {
  supported: boolean;
  acquired: boolean;
  /** False when the browser took the lock back before the run finished. */
  heldToEnd: boolean;
  error: ProbeError | null;
}

/** Safari reports a non-standard `interrupted` state the DOM types omit. */
export type ProbeContextState = AudioContextState | "interrupted";

export interface ContextStateTransition {
  /** Seconds since the capture graph was built. */
  atSeconds: number;
  state: ProbeContextState;
}

export interface ContextStateCheck {
  stayedRunning: boolean;
  transitions: ContextStateTransition[];
}

export const PROBE_CHECKS = [
  "secure_context",
  "media_api",
  "voice_processing",
  "audio_context",
  "capture",
  "wake_lock",
  "context_state",
] as const;

export type ProbeCheckId = (typeof PROBE_CHECKS)[number];

export type CheckStatus = "pass" | "warn" | "fail" | "not_evaluated";

/**
 * `blocked` means the browser never let the probe start, which is a deployment
 * or permission problem rather than a verdict on the phone.
 */
export type ProbeVerdict = "ready" | "degraded" | "unsupported" | "blocked";

export interface ProbeSummary {
  verdict: ProbeVerdict;
  checks: Record<ProbeCheckId, CheckStatus>;
}

/** The whole probe outcome, and the payload behind the copy button. */
export interface MicrophoneProbeReport {
  version: 1;
  startedAt: string;
  userAgent: string;
  secureContext: SecureContextCheck;
  mediaApi: MediaApiCheck;
  constraints: ConstraintCheck | null;
  audioContext: AudioContextCheck | null;
  capture: CaptureCheck | null;
  wakeLock: WakeLockCheck | null;
  contextState: ContextStateCheck | null;
}

/**
 * Drives one probe run and exposes its report as the checks fill in.
 *
 * `run` has to be called from a user gesture: it opens the `AudioContext`
 * before its first `await` so Safari still counts the tap. Leaving the view
 * mid-run aborts the capture and releases the microphone.
 */
export function useMicrophoneProbe() {
  const running = ref(false);
  const report = ref<MicrophoneProbeReport | null>(null);
  const captureElapsed = ref(0);

  const captureProgress = computed(() =>
    Math.min(100, Math.round((captureElapsed.value / CAPTURE_SECONDS) * 100)),
  );
  const captureRemainingSeconds = computed(() =>
    Math.max(0, Math.ceil(CAPTURE_SECONDS - captureElapsed.value)),
  );
  const reportJson = computed(() =>
    report.value ? JSON.stringify(report.value, null, 2) : "",
  );

  let abort: AbortController | null = null;
  onScopeDispose(() => abort?.abort());

  async function run(): Promise<void> {
    if (running.value) return;
    running.value = true;
    captureElapsed.value = 0;
    abort = new AbortController();
    const signal = abort.signal;

    const result = startReport();
    report.value = result;

    let context: AudioContext | null = null;
    let wakeLock: ScreenAwake | null = null;
    if (result.mediaApi.getUserMedia)
      try {
        // Opened before any await so Safari still counts the user gesture.
        context = new AudioContext();
      } catch (error) {
        // Safari caps how many contexts a page may hold, and refusing one is a
        // result worth reporting rather than an exception into a click handler.
        result.capture = { ...emptyCapture(), error: describeError(error) };
      }

    try {
      wakeLock = await holdScreenAwake(result.secureContext.secure);
      result.wakeLock = wakeLock.check;
      if (!context) return;

      const stream = await openMicrophone(result);
      if (!stream) return;
      try {
        if (signal.aborted) return;
        await capture(context, stream, result, signal, (elapsed) => {
          captureElapsed.value = elapsed;
        });
      } finally {
        for (const track of stream.getTracks()) track.stop();
      }
    } finally {
      await context?.close().catch(() => undefined);
      await wakeLock?.release();
      running.value = false;
    }
  }

  return {
    running,
    report,
    reportJson,
    captureProgress,
    captureRemainingSeconds,
    run,
  };
}

/**
 * Reduces a report to one status per check plus an overall verdict.
 *
 * `not_evaluated` is deliberately distinct from `fail`: on a plain-HTTP origin
 * most of the probe never runs, and calling that a device failure would send
 * people chasing the wrong problem.
 */
export function summarizeProbe(report: MicrophoneProbeReport): ProbeSummary {
  const constraints = report.constraints;
  const capture = report.capture;
  const wakeLock = report.wakeLock;

  const checks: Record<ProbeCheckId, CheckStatus> = {
    secure_context: report.secureContext.secure ? "pass" : "fail",
    media_api: report.mediaApi.getUserMedia ? "pass" : "fail",
    // An error here means the microphone never opened, so nothing was applied
    // to judge; the verdict below calls that blocked rather than unsupported.
    voice_processing:
      !constraints || constraints.error
        ? "not_evaluated"
        : VOICE_PROCESSING.some((name) => constraints.applied[name])
          ? "fail"
          : constraints.honored
            ? "pass"
            : "warn",
    audio_context: report.audioContext ? "pass" : "not_evaluated",
    capture: !capture
      ? "not_evaluated"
      : capture.error
        ? "fail"
        : capture.silentQuanta > 0 ||
            Math.abs(capture.frameDiscrepancyPpm) > DRIFT_WARN_PPM ||
            Math.abs(capture.clockDriftPpm) > DRIFT_WARN_PPM
          ? "warn"
          : "pass",
    wake_lock: !wakeLock
      ? "not_evaluated"
      : wakeLock.acquired && wakeLock.heldToEnd
        ? "pass"
        : "warn",
    context_state: !report.contextState
      ? "not_evaluated"
      : report.contextState.stayedRunning
        ? "pass"
        : "fail",
  };

  const failed = (id: ProbeCheckId) => checks[id] === "fail";
  const verdict: ProbeVerdict =
    failed("secure_context") ||
    failed("media_api") ||
    Boolean(constraints?.error)
      ? "blocked"
      : failed("voice_processing") ||
          failed("capture") ||
          failed("context_state")
        ? "unsupported"
        : Object.values(checks).includes("warn")
          ? "degraded"
          : "ready";

  return { verdict, checks };
}

function startReport(): MicrophoneProbeReport {
  return {
    version: 1,
    startedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    secureContext: {
      secure: window.isSecureContext,
      origin: window.location.origin,
      protocol: window.location.protocol,
    },
    mediaApi: {
      mediaDevices: Boolean(navigator.mediaDevices),
      getUserMedia: typeof navigator.mediaDevices?.getUserMedia === "function",
    },
    constraints: null,
    audioContext: null,
    capture: null,
    wakeLock: null,
    contextState: null,
  };
}

/** Requests the microphone and records what the browser applied to the track. */
async function openMicrophone(
  result: MicrophoneProbeReport,
): Promise<MediaStream | null> {
  if (!result.mediaApi.getUserMedia) return null;

  const requested = Object.fromEntries(
    VOICE_PROCESSING.map((name) => [name, false]),
  ) as Record<VoiceProcessing, boolean>;
  const supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
  const supported = Object.fromEntries(
    VOICE_PROCESSING.map((name) => [name, Boolean(supportedConstraints[name])]),
  ) as Record<VoiceProcessing, boolean>;

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: requested });
  } catch (error) {
    result.constraints = {
      requested,
      applied: {},
      supported,
      honored: false,
      trackSettings: {},
      trackLabel: "",
      error: describeError(error),
    };
    return null;
  }

  const track = stream.getAudioTracks()[0];
  const settings = track?.getSettings() ?? {};
  const applied: Partial<Record<VoiceProcessing, boolean>> = {};
  for (const name of VOICE_PROCESSING) {
    const value = settings[name];
    if (typeof value === "boolean") applied[name] = value;
  }

  result.constraints = {
    requested,
    applied,
    supported,
    honored: VOICE_PROCESSING.every((name) => applied[name] === false),
    trackSettings: settings,
    trackLabel: track?.label ?? "",
    error: track
      ? null
      : {
          name: "NoAudioTrackError",
          message: "The captured stream carried no audio track",
        },
  };
  if (track) return stream;

  for (const orphan of stream.getTracks()) orphan.stop();
  return null;
}

/**
 * Runs the microphone through the frame counter worklet for {@link CAPTURE_SECONDS}.
 *
 * What this measures is the *render* clock, not the microphone's own: the
 * source node resamples the capture device into the context's rate before the
 * worklet ever sees it. That is still the clock a chirp's arrival time is
 * stamped against, so its steadiness is what calibration depends on.
 */
async function capture(
  context: AudioContext,
  stream: MediaStream,
  result: MicrophoneProbeReport,
  signal: AbortSignal,
  onProgress: (elapsedSeconds: number) => void,
): Promise<void> {
  const transitions: ContextStateTransition[] = [];
  let source: MediaStreamAudioSourceNode | null = null;
  let counter: AudioWorkletNode | null = null;
  let sink: GainNode | null = null;
  let baseline = 0;
  const onStateChange = () => {
    transitions.push({
      atSeconds: context.currentTime - baseline,
      state: context.state,
    });
  };

  try {
    await context.resume();
    result.audioContext = {
      sampleRate: context.sampleRate,
      baseLatency: finiteOrNull(context.baseLatency),
      outputLatency: finiteOrNull(context.outputLatency),
    };

    await context.audioWorklet.addModule(frameCounterUrl);
    source = context.createMediaStreamSource(stream);
    counter = new AudioWorkletNode(context, "sendspin-frame-counter", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    // The worklet emits silence; the muted sink exists only to keep the graph
    // attached to the destination so the audio thread keeps pulling it.
    sink = context.createGain();
    sink.gain.value = 0;
    source.connect(counter).connect(sink).connect(context.destination);

    baseline = context.currentTime;
    context.addEventListener("statechange", onStateChange);
    result.capture = await countFrames(context, counter, signal, onProgress);
  } catch (error) {
    result.capture = { ...emptyCapture(), error: describeError(error) };
  } finally {
    context.removeEventListener("statechange", onStateChange);
    source?.disconnect();
    counter?.disconnect();
    counter?.port.close();
    sink?.disconnect();
    result.contextState = {
      stayedRunning: transitions.every(
        (transition) => transition.state === "running",
      ),
      transitions,
    };
  }
}

function countFrames(
  context: AudioContext,
  counter: AudioWorkletNode,
  signal: AbortSignal,
  onProgress: (elapsedSeconds: number) => void,
): Promise<CaptureCheck> {
  return new Promise<CaptureCheck>((resolve) => {
    const samples: CaptureSample[] = [];
    counter.port.onmessage = (event: MessageEvent<FrameCounterReport>) => {
      samples.push({ ...event.data, at: performance.now() });
    };

    const startedAt = performance.now();
    const progress = setInterval(() => {
      onProgress((performance.now() - startedAt) / 1000);
    }, PROGRESS_INTERVAL_MS);

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearInterval(progress);
      clearTimeout(deadline);
      counter.port.onmessage = null;
      onProgress((performance.now() - startedAt) / 1000);
      resolve(measure(context.sampleRate, samples));
    };

    const deadline = setTimeout(finish, CAPTURE_SECONDS * 1000);
    signal.addEventListener("abort", finish, { once: true });
    // A signal aborted before this point never fires the event.
    if (signal.aborted) finish();
  });
}

/**
 * Turns the collected reports into two independent readings.
 *
 * The frame totals and the render clock both come off the audio thread, so
 * comparing them carries no main-thread jitter at all. Comparing the render
 * clock with the system clock cannot avoid that jitter, so it is handled
 * separately in {@link clockDriftPpm}.
 */
function measure(sampleRate: number, samples: CaptureSample[]): CaptureCheck {
  const first = samples[0];
  const last = samples[samples.length - 1];
  const renderSeconds =
    first && last ? last.contextTime - first.contextTime : 0;
  if (!first || !last || renderSeconds <= 0)
    return {
      ...emptyCapture(),
      error: {
        name: "NoFramesError",
        message: "The worklet delivered no measurable frames",
      },
    };

  const framesDelivered = last.frames - first.frames;
  const expectedFrames = sampleRate * renderSeconds;
  return {
    requestedSeconds: CAPTURE_SECONDS,
    measuredSeconds: (last.at - first.at) / 1000,
    renderSeconds,
    framesDelivered,
    expectedFrames,
    frameDiscrepancyPpm:
      ((framesDelivered - expectedFrames) / expectedFrames) * 1e6,
    silentQuanta: last.silentQuanta - first.silentQuanta,
    quanta: last.quanta - first.quanta,
    clockDriftPpm: clockDriftPpm(samples),
    error: null,
  };
}

/**
 * Slope of the render clock against the system clock, in ppm.
 *
 * A report can only ever arrive late, never early, so the least delayed report
 * in a window is the closest thing to a true reading of the pair of clocks.
 * Taking one from each end of the run keeps scheduling jitter out of the slope.
 */
function clockDriftPpm(samples: CaptureSample[]): number {
  const window = Math.max(1, Math.floor(samples.length / 3));
  const start = leastDelayed(samples.slice(0, window));
  const end = leastDelayed(samples.slice(-window));
  const wallMs = end.at - start.at;
  if (wallMs <= 0) return 0;

  const renderMs = (end.contextTime - start.contextTime) * 1000;
  return ((renderMs - wallMs) / wallMs) * 1e6;
}

function leastDelayed(samples: CaptureSample[]): CaptureSample {
  const delay = (sample: CaptureSample) =>
    sample.at - sample.contextTime * 1000;
  return samples.reduce((best, sample) =>
    delay(sample) < delay(best) ? sample : best,
  );
}

/** What the caller must release once the run is over. */
interface ScreenAwake {
  check: WakeLockCheck | null;
  release: () => Promise<void>;
}

/**
 * Holds the screen awake for the run, and hands back the release.
 *
 * The API is secure-context only, so an insecure origin reports nothing rather
 * than a failure the device is not responsible for. A lock the browser takes
 * back mid-run is recorded, because calibration needs it for several minutes.
 */
async function holdScreenAwake(secureContext: boolean): Promise<ScreenAwake> {
  const idle = { release: async () => undefined };
  if (!secureContext) return { check: null, ...idle };

  const supported = "wakeLock" in navigator;
  if (!supported)
    return {
      check: { supported, acquired: false, heldToEnd: false, error: null },
      ...idle,
    };

  try {
    const sentinel = await navigator.wakeLock.request("screen");
    const check: WakeLockCheck = {
      supported,
      acquired: true,
      heldToEnd: true,
      error: null,
    };
    const onRelease = () => {
      check.heldToEnd = false;
    };
    sentinel.addEventListener("release", onRelease);
    return {
      check,
      release: async () => {
        // Detached first so this release is not read as the browser's.
        sentinel.removeEventListener("release", onRelease);
        await sentinel.release().catch(() => undefined);
      },
    };
  } catch (error) {
    return {
      check: {
        supported,
        acquired: false,
        heldToEnd: false,
        error: describeError(error),
      },
      ...idle,
    };
  }
}

function emptyCapture(): CaptureCheck {
  return {
    requestedSeconds: CAPTURE_SECONDS,
    measuredSeconds: 0,
    renderSeconds: 0,
    framesDelivered: 0,
    expectedFrames: 0,
    frameDiscrepancyPpm: 0,
    silentQuanta: 0,
    quanta: 0,
    clockDriftPpm: 0,
    error: null,
  };
}

function finiteOrNull(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function describeError(error: unknown): ProbeError {
  if (error instanceof Error)
    return { name: error.name, message: error.message };
  return { name: "Error", message: String(error) };
}
