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
  leadInQuanta: number;
  droppedQuanta: number;
  unconnectedQuanta: number;
  peak: number;
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

/**
 * What the capture observed.
 *
 * `discrepancyPpm` and the counts it is derived from are measured between the
 * two least delayed reports of the run (see {@link anchors}), so they span
 * rather less than `requestedSeconds` — `measuredSeconds` and `measuredQuanta`
 * are that span. The tallies below them cover the whole capture, because a
 * dropout in the discarded ends still happened; `totalQuanta` is their
 * denominator.
 */
export interface CaptureCheck {
  requestedSeconds: number;
  /** Wall-clock seconds the discrepancy was measured over. */
  measuredSeconds: number;
  /**
   * Seconds the audio pipeline's own clock advanced over the same span.
   *
   * Expected to match `framesDelivered / sampleRate`, since a render quantum is
   * a fixed 128 frames. Whether a browser really derives its clock that way is
   * implementation-defined, and this is what checks it.
   */
  renderSeconds: number;
  measuredQuanta: number;
  framesDelivered: number;
  /** What the system clock says should have arrived over `measuredSeconds`. */
  expectedFrames: number;
  /**
   * Delivered frames against expected, in parts per million.
   *
   * The frames are counted on the audio thread and the expectation comes from
   * the system clock, so this is the audio pipeline measured against the
   * system — the one figure a chirp's arrival time depends on.
   */
  discrepancyPpm: number;
  /** Render quanta over the whole capture, the denominator for the counts below. */
  totalQuanta: number;
  /** Silent quanta before any signal arrived: the capture device warming up. */
  leadInQuanta: number;
  /**
   * Silent quanta after signal had arrived: a gap in the audio.
   *
   * A noise gate the browser would not switch off, or an OS-level mute, also
   * produces true silence — so read this next to the voice processing check
   * rather than as a dropout on its own.
   */
  droppedQuanta: number;
  /** Quanta with no input connected at all; anything but zero means a broken graph. */
  unconnectedQuanta: number;
  /** Loudest sample of the whole capture. Zero means the microphone heard nothing. */
  peakAmplitude: number;
  /** False when the audio pipeline never got as far as capturing. */
  started: boolean;
  /** True when the view was left before the capture could finish. */
  aborted: boolean;
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
      // Asking now would raise a permission prompt for a view that has gone.
      if (!context || signal.aborted) return;

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
/**
 * Whether the audio pipeline failed before it could capture anything.
 *
 * A context the browser refused, or a worklet that would not load, says nothing
 * about the microphone — the same reasoning as a refused permission, and the
 * reason both are reported as blocked rather than as a bad measurement.
 */
export function pipelineNeverOpened(report: MicrophoneProbeReport): boolean {
  return Boolean(report.capture?.error) && !report.capture?.started;
}

export function summarizeProbe(report: MicrophoneProbeReport): ProbeSummary {
  const constraints = report.constraints;
  const capture = report.capture;
  const wakeLock = report.wakeLock;
  const blockedBeforeCapture = pipelineNeverOpened(report);

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
    capture:
      !capture || capture.aborted || blockedBeforeCapture
        ? "not_evaluated"
        : // A capture of pure silence is the one outcome that must never read
          // as success: the chirp would never be found in it.
          capture.error || capture.peakAmplitude === 0
          ? "fail"
          : capture.droppedQuanta > 0 ||
              capture.unconnectedQuanta > 0 ||
              Math.abs(capture.discrepancyPpm) > DRIFT_WARN_PPM
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
    Boolean(constraints?.error) ||
    blockedBeforeCapture
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
  const supported = {} as Record<VoiceProcessing, boolean>;

  let stream: MediaStream | null = null;
  try {
    const known = navigator.mediaDevices.getSupportedConstraints();
    for (const name of VOICE_PROCESSING) supported[name] = Boolean(known[name]);
    stream = await navigator.mediaDevices.getUserMedia({ audio: requested });

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
  }

  // Nothing usable came back, and nothing else will be holding this stream.
  for (const orphan of stream?.getTracks() ?? []) orphan.stop();
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
  let watching = false;
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

    if (signal.aborted) return;

    await context.audioWorklet.addModule(frameCounterUrl);
    if (signal.aborted) return;

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
    watching = true;
    // A context the browser declined to start fires no change of its own, so
    // the state it settled on has to be recorded here or it is never reported.
    if (context.state !== "running") onStateChange();

    result.capture = await countFrames(context, counter, signal, onProgress);
  } catch (error) {
    result.capture = {
      ...emptyCapture(),
      aborted: signal.aborted,
      error: describeError(error),
    };
  } finally {
    context.removeEventListener("statechange", onStateChange);
    source?.disconnect();
    counter?.disconnect();
    counter?.port.close();
    sink?.disconnect();
    // Left null when the graph never ran: an empty transition list would
    // otherwise read as "it stayed running the whole time".
    if (watching)
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
      signal.removeEventListener("abort", finish);
      counter.port.onmessage = null;
      onProgress((performance.now() - startedAt) / 1000);
      resolve(measure(context.sampleRate, samples, signal.aborted));
    };

    const deadline = setTimeout(finish, CAPTURE_SECONDS * 1000);
    signal.addEventListener("abort", finish, { once: true });
    // A signal aborted before this point never fires the event.
    if (signal.aborted) finish();
  });
}

/**
 * Turns the collected reports into the capture's readings.
 *
 * The discrepancy comes from the anchors so scheduling jitter stays out of it;
 * the tallies come from the last report, which carries the whole capture.
 */
function measure(
  sampleRate: number,
  samples: CaptureSample[],
  aborted: boolean,
): CaptureCheck {
  const latest = samples[samples.length - 1];
  const span = anchors(samples);
  if (!latest || !span)
    return {
      ...emptyCapture(),
      started: true,
      aborted,
      error: aborted
        ? null
        : {
            name: "NoFramesError",
            message: "The worklet delivered no measurable frames",
          },
    };

  const { start, end } = span;
  const measuredSeconds = (end.at - start.at) / 1000;
  const framesDelivered = end.frames - start.frames;
  const expectedFrames = sampleRate * measuredSeconds;
  return {
    requestedSeconds: CAPTURE_SECONDS,
    measuredSeconds,
    renderSeconds: end.contextTime - start.contextTime,
    measuredQuanta: end.quanta - start.quanta,
    framesDelivered,
    expectedFrames,
    discrepancyPpm: ((framesDelivered - expectedFrames) / expectedFrames) * 1e6,
    totalQuanta: latest.quanta,
    leadInQuanta: latest.leadInQuanta,
    droppedQuanta: latest.droppedQuanta,
    unconnectedQuanta: latest.unconnectedQuanta,
    peakAmplitude: latest.peak,
    started: true,
    aborted,
    error: null,
  };
}

/**
 * Picks the least delayed report from each end of the run.
 *
 * A report can only ever arrive late, never early, so the smallest gap between
 * the two clocks is the closest thing to a true reading of the pair. Taking one
 * from each end keeps main-thread scheduling jitter out of every rate measured
 * between them. Returns null when the run was too short to span two reports.
 */
function anchors(
  samples: CaptureSample[],
): { start: CaptureSample; end: CaptureSample } | null {
  if (samples.length < 2) return null;

  const window = Math.max(1, Math.floor(samples.length / 3));
  const start = leastDelayed(samples.slice(0, window));
  const end = leastDelayed(samples.slice(-window));
  return end.at > start.at && end.contextTime > start.contextTime
    ? { start, end }
    : null;
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
    measuredQuanta: 0,
    framesDelivered: 0,
    expectedFrames: 0,
    discrepancyPpm: 0,
    totalQuanta: 0,
    leadInQuanta: 0,
    droppedQuanta: 0,
    unconnectedQuanta: 0,
    peakAmplitude: 0,
    started: false,
    aborted: false,
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
