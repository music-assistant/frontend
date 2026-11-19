/**
 * Opening a microphone for Sendspin calibration, and keeping the screen awake
 * while it is open.
 *
 * A calibration run needs a capture with the browser's voice processing
 * switched off, and needs the screen to stay on for minutes at a time. Each
 * check reports what the browser actually did
 * rather than what was asked for, so a caller can tell a refusal apart from a
 * device that is simply not there.
 */

/** The voice processing a calibration capture needs switched off. */
const VOICE_PROCESSING = [
  "echoCancellation",
  "noiseSuppression",
  "autoGainControl",
] as const;

type VoiceProcessing = (typeof VOICE_PROCESSING)[number];

/** A failure kept whole: the name is what tells the reader which one it was. */
export interface ProbeError {
  name: string;
  message: string;
}

/** Safari reports a non-standard `interrupted` state the DOM types omit. */
export type ProbeContextState = AudioContextState | "interrupted";

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

export interface WakeLockCheck {
  supported: boolean;
  acquired: boolean;
  /** False when the browser took the lock back before the run finished. */
  heldToEnd: boolean;
  error: ProbeError | null;
}

/** A capture attempt: the stream when there is one, and what the browser did. */
interface MicrophoneCapture {
  stream: MediaStream | null;
  constraints: ConstraintCheck;
}

/** What the caller must release once the run is over. */
export interface ScreenAwake {
  check: WakeLockCheck | null;
  release: () => Promise<void>;
}

/**
 * Request the microphone, and report what the browser applied to the track.
 *
 * A `null` stream means nothing was captured and `constraints.error` says why.
 * Callers must check `navigator.mediaDevices.getUserMedia` exists first; this
 * assumes it does.
 */
export async function openMicrophone(): Promise<MicrophoneCapture> {
  const requested = Object.fromEntries(
    VOICE_PROCESSING.map((name) => [name, false]),
  ) as Record<VoiceProcessing, boolean>;
  const supported = {} as Record<VoiceProcessing, boolean>;

  let stream: MediaStream | null = null;
  let constraints: ConstraintCheck;
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

    constraints = {
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
    if (track) return { stream, constraints };
  } catch (error) {
    constraints = {
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
  return { stream: null, constraints };
}

/**
 * Hold the screen awake for the run, and hand back the release.
 *
 * The API is secure-context only, so an insecure origin reports nothing rather
 * than a failure the device is not responsible for. A lock the browser takes
 * back mid-run is recorded, because calibration needs it for several minutes.
 */
export async function holdScreenAwake(
  secureContext: boolean,
): Promise<ScreenAwake> {
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

/**
 * Reduce anything thrown into a reportable failure.
 *
 * The name is kept because it is what tells a reader which failure this was —
 * `NotAllowedError` and `NotFoundError` call for completely different advice.
 */
export function describeError(error: unknown): ProbeError {
  if (error instanceof Error)
    return { name: error.name, message: error.message };
  return { name: "Error", message: String(error) };
}
