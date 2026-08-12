import {
  CAPTURE_SECONDS,
  summarizeProbe,
  useMicrophoneProbe,
  type CaptureCheck,
  type MicrophoneProbeReport,
} from "@/composables/sendspin-sync/useMicrophoneProbe";
import { effectScope } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SAMPLE_RATE = 48000;
const RENDER_QUANTUM = 128;

/** Everything a capture fixture may set; the rest is derived from these. */
type CaptureOverrides = Partial<
  Omit<
    CaptureCheck,
    "framesDelivered" | "expectedFrames" | "renderSeconds" | "discrepancyPpm"
  >
>;

/** Worklet nodes the composable created, newest last. */
let workletNodes: FakeWorkletNode[] = [];
let restores: (() => void)[] = [];

beforeEach(() => {
  workletNodes = [];
  restores = [];
});

afterEach(() => {
  for (const restore of restores.reverse()) restore();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("capture fixtures", () => {
  // Two passes of review were misled by fixtures encoding readings the worklet
  // could not emit, so the derived fields are pinned to hand-worked numbers.
  it("derive their readings the way a real capture would", () => {
    const clean = captureFixture({});
    expect(clean.framesDelivered).toBe(960_000);
    expect(clean.renderSeconds).toBe(20);
    expect(clean.discrepancyPpm).toBe(0);

    const short = captureFixture({ measuredQuanta: 7481 });
    expect(short.framesDelivered).toBe(957_568);
    expect(short.renderSeconds).toBeCloseTo(19.949_333_333, 9);
    expect(short.discrepancyPpm).toBeCloseTo(-2533.333_333_333, 6);
  });
});

describe("summarizeProbe", () => {
  it("calls an insecure origin blocked rather than a device failure", () => {
    const summary = summarizeProbe(
      reportFixture({
        secureContext: {
          secure: false,
          origin: "http://ma.local",
          protocol: "http:",
        },
        mediaApi: { mediaDevices: false, getUserMedia: false },
        constraints: null,
        audioContext: null,
        capture: null,
        wakeLock: null,
        contextState: null,
      }),
    );

    expect(summary.verdict).toBe("blocked");
    expect(summary.checks.secure_context).toBe("fail");
    expect(summary.checks.voice_processing).toBe("not_evaluated");
    expect(summary.checks.wake_lock).toBe("not_evaluated");
  });

  it("fails the run when the browser kept a voice processor on", () => {
    const summary = summarizeProbe(
      reportFixture({
        constraints: constraintsFixture({
          applied: {
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: false,
          },
          honored: false,
        }),
      }),
    );

    expect(summary.checks.voice_processing).toBe("fail");
    expect(summary.verdict).toBe("unsupported");
  });

  it("only warns when a constraint was never reported back", () => {
    const summary = summarizeProbe(
      reportFixture({
        constraints: constraintsFixture({
          applied: { noiseSuppression: false, autoGainControl: false },
          honored: false,
        }),
      }),
    );

    expect(summary.checks.voice_processing).toBe("warn");
    expect(summary.verdict).toBe("degraded");
  });

  it("warns on a drifting clock and on a gap in the audio", () => {
    // 7481 quanta where 20 s at 48 kHz calls for 7500 is a 2533 ppm shortfall.
    const drifting = summarizeProbe(
      reportFixture({ capture: captureFixture({ measuredQuanta: 7481 }) }),
    );
    const dropped = summarizeProbe(
      reportFixture({ capture: captureFixture({ droppedQuanta: 3 }) }),
    );
    const unconnected = summarizeProbe(
      reportFixture({ capture: captureFixture({ unconnectedQuanta: 1 }) }),
    );

    expect(drifting.checks.capture).toBe("warn");
    expect(dropped.checks.capture).toBe("warn");
    expect(unconnected.checks.capture).toBe("warn");
  });

  it("passes a run that only had to wait for the microphone to wake up", () => {
    const summary = summarizeProbe(
      reportFixture({ capture: captureFixture({ leadInQuanta: 40 }) }),
    );

    expect(summary.checks.capture).toBe("pass");
    expect(summary.verdict).toBe("ready");
  });

  it("fails a capture that heard nothing at all", () => {
    const summary = summarizeProbe(
      reportFixture({ capture: captureFixture({ peakAmplitude: 0 }) }),
    );

    expect(summary.checks.capture).toBe("fail");
    expect(summary.verdict).toBe("unsupported");
  });

  it("does not judge a capture the viewer walked away from", () => {
    const summary = summarizeProbe(
      reportFixture({
        capture: captureFixture({ aborted: true, peakAmplitude: 0 }),
      }),
    );

    expect(summary.checks.capture).toBe("not_evaluated");
  });

  it("blames the browser, not the phone, when the pipeline never opened", () => {
    const summary = summarizeProbe(
      reportFixture({
        capture: {
          ...captureFixture({}),
          started: false,
          error: { name: "AbortError", message: "worklet module failed" },
        },
      }),
    );

    expect(summary.checks.capture).toBe("not_evaluated");
    expect(summary.verdict).toBe("blocked");
  });

  it("warns when the browser took the wake lock back mid-run", () => {
    const summary = summarizeProbe(
      reportFixture({
        wakeLock: {
          supported: true,
          acquired: true,
          heldToEnd: false,
          error: null,
        },
      }),
    );

    expect(summary.checks.wake_lock).toBe("warn");
    expect(summary.verdict).toBe("degraded");
  });

  it("reports a clean run as ready", () => {
    const summary = summarizeProbe(reportFixture({}));

    expect(summary.verdict).toBe("ready");
    expect(Object.values(summary.checks)).toEqual(Array(7).fill("pass"));
  });
});

describe("useMicrophoneProbe", () => {
  it("records the origin and stops when the browser has no capture API", async () => {
    stubBrowser({ secure: false, mediaDevices: false });

    const probe = withScope(() => useMicrophoneProbe());
    await probe.run();

    expect(probe.report.value?.secureContext.secure).toBe(false);
    expect(probe.report.value?.mediaApi.getUserMedia).toBe(false);
    expect(probe.report.value?.constraints).toBeNull();
    expect(probe.report.value?.wakeLock).toBeNull();
    expect(probe.running.value).toBe(false);
  });

  it("keeps the DOMException name when the microphone is refused", async () => {
    const browser = stubBrowser({
      getUserMedia: vi
        .fn()
        .mockRejectedValue(new DOMException("Denied", "NotAllowedError")),
    });

    const probe = withScope(() => useMicrophoneProbe());
    await probe.run();

    expect(probe.report.value?.constraints?.error).toEqual({
      name: "NotAllowedError",
      message: "Denied",
    });
    expect(probe.report.value?.capture).toBeNull();
    expect(browser.context.close).toHaveBeenCalled();
    expect(browser.track.stop).not.toHaveBeenCalled();

    // A refusal is a permission problem, not a verdict on the microphone.
    const summary = summarizeProbe(probe.report.value!);
    expect(summary.verdict).toBe("blocked");
    expect(summary.checks.voice_processing).toBe("not_evaluated");
  });

  it("reports a refused audio context instead of throwing at the click", async () => {
    stubBrowser({ audioContextThrows: true });

    const probe = withScope(() => useMicrophoneProbe());
    await expect(probe.run()).resolves.toBeUndefined();

    expect(probe.report.value?.capture?.error).toEqual({
      name: "Error",
      message: "Too many contexts",
    });
    // No pipeline ever opened, so this is a browser problem rather than a
    // measurement that came back bad.
    expect(probe.report.value?.capture?.started).toBe(false);
    const summary = summarizeProbe(probe.report.value!);
    expect(summary.checks.capture).toBe("not_evaluated");
    expect(summary.verdict).toBe("blocked");
    expect(probe.running.value).toBe(false);
  });

  it("reports the applied constraints and both drift readings", async () => {
    vi.useFakeTimers();
    const browser = stubBrowser({
      settings: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
      },
    });

    const probe = withScope(() => useMicrophoneProbe());
    const pending = probe.run();
    await vi.advanceTimersByTimeAsync(0);

    const worklet = workletNodes[0];
    expect(worklet).toBeDefined();
    worklet.emit(workletReport({}));

    // Twenty wall-clock seconds on, the pipeline has rendered 7485 quanta of
    // 128 frames — 19.96 s of audio where the system clock expected 20, so it
    // is running 2000 ppm slow. Sixty-eight of those quanta were silent.
    await vi.advanceTimersByTimeAsync(20_000);
    worklet.emit(
      workletReport({
        frames: 7485 * 128,
        quanta: 7485,
        droppedQuanta: 68,
        peak: 0.2,
        contextTime: (7485 * 128) / SAMPLE_RATE,
      }),
    );

    await vi.advanceTimersByTimeAsync(CAPTURE_SECONDS * 1000 - 20_000);
    await pending;

    const report = probe.report.value;
    expect(report?.constraints?.applied).toEqual({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: true,
    });
    expect(report?.constraints?.honored).toBe(false);
    expect(report?.audioContext).toEqual({
      sampleRate: SAMPLE_RATE,
      baseLatency: 0.005,
      outputLatency: 0.02,
    });
    expect(report?.capture?.measuredSeconds).toBeCloseTo(20, 3);
    expect(report?.capture?.renderSeconds).toBeCloseTo(19.96, 6);
    expect(report?.capture?.framesDelivered).toBe(7485 * 128);
    expect(report?.capture?.expectedFrames).toBe(SAMPLE_RATE * 20);
    expect(report?.capture?.discrepancyPpm).toBeCloseTo(-2000, 6);
    expect(report?.capture?.measuredQuanta).toBe(7485);
    expect(report?.capture?.totalQuanta).toBe(7485);
    expect(report?.capture?.droppedQuanta).toBe(68);
    expect(report?.capture?.leadInQuanta).toBe(0);
    expect(report?.capture?.unconnectedQuanta).toBe(0);
    expect(report?.capture?.peakAmplitude).toBe(0.2);
    expect(report?.contextState?.stayedRunning).toBe(true);
    expect(summarizeProbe(report!).verdict).toBe("unsupported");

    // The microphone must never outlive the run.
    expect(browser.track.stop).toHaveBeenCalledOnce();
    expect(browser.context.close).toHaveBeenCalledOnce();
    expect(browser.wakeLockSentinel.release).toHaveBeenCalledOnce();
    expect(probe.running.value).toBe(false);
  });

  it("does not read its own wake lock release as the browser's", async () => {
    vi.useFakeTimers();
    const browser = stubBrowser({});

    const probe = withScope(() => useMicrophoneProbe());
    const pending = probe.run();
    await vi.advanceTimersByTimeAsync(0);
    workletNodes[0].emit(workletReport({}));
    await vi.advanceTimersByTimeAsync(CAPTURE_SECONDS * 1000);
    await pending;

    expect(browser.wakeLockSentinel.release).toHaveBeenCalledOnce();
    expect(probe.report.value?.wakeLock?.heldToEnd).toBe(true);
  });

  it("records a wake lock the browser took back during the capture", async () => {
    vi.useFakeTimers();
    const browser = stubBrowser({});

    const probe = withScope(() => useMicrophoneProbe());
    const pending = probe.run();
    await vi.advanceTimersByTimeAsync(0);
    browser.wakeLockSentinel.dispatchEvent(new Event("release"));
    await vi.advanceTimersByTimeAsync(CAPTURE_SECONDS * 1000);
    await pending;

    expect(probe.report.value?.wakeLock?.heldToEnd).toBe(false);
  });

  it("flags an audio context that left the running state", async () => {
    vi.useFakeTimers();
    const browser = stubBrowser({});

    const probe = withScope(() => useMicrophoneProbe());
    const pending = probe.run();
    await vi.advanceTimersByTimeAsync(0);

    browser.context.setState("interrupted");
    workletNodes[0].emit(workletReport({}));
    await vi.advanceTimersByTimeAsync(CAPTURE_SECONDS * 1000);
    await pending;

    expect(probe.report.value?.contextState?.stayedRunning).toBe(false);
    expect(probe.report.value?.capture?.error).toEqual({
      name: "NoFramesError",
      message: "The worklet delivered no measurable frames",
    });
  });

  it("releases the microphone when the view goes away mid-capture", async () => {
    vi.useFakeTimers();
    const browser = stubBrowser({});
    const scope = effectScope();
    const probe = scope.run(() => useMicrophoneProbe())!;

    const pending = probe.run();
    await vi.advanceTimersByTimeAsync(1000);
    scope.stop();
    await pending;

    expect(browser.track.stop).toHaveBeenCalledOnce();
    expect(browser.context.close).toHaveBeenCalledOnce();
    expect(probe.running.value).toBe(false);
  });

  it("releases the microphone when the view goes away while the worklet loads", async () => {
    vi.useFakeTimers();
    const module = deferred();
    const browser = stubBrowser({ addModule: () => module.promise });
    const scope = effectScope();
    const probe = scope.run(() => useMicrophoneProbe())!;

    const pending = probe.run();
    await vi.advanceTimersByTimeAsync(0);
    // Aborting here leaves nothing listening for the abort event yet.
    scope.stop();
    module.resolve();
    await pending;

    expect(browser.track.stop).toHaveBeenCalledOnce();
    expect(browser.context.close).toHaveBeenCalledOnce();
    expect(browser.wakeLockSentinel.release).toHaveBeenCalledOnce();
    expect(probe.running.value).toBe(false);
  });
});

/** Runs a composable inside a scope the test tears down for it. */
function withScope<T>(factory: () => T): T {
  const scope = effectScope();
  const value = scope.run(factory)!;
  restores.push(() => scope.stop());
  return value;
}

/** One worklet report, with the zeroed defaults a run starts from. */
function workletReport(overrides: Record<string, number>) {
  return {
    frames: 0,
    quanta: 0,
    leadInQuanta: 0,
    droppedQuanta: 0,
    unconnectedQuanta: 0,
    peak: 0,
    contextTime: 0,
    ...overrides,
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

interface BrowserStubOptions {
  secure?: boolean;
  mediaDevices?: boolean;
  getUserMedia?: () => Promise<MediaStream>;
  settings?: MediaTrackSettings;
  addModule?: () => Promise<void>;
  audioContextThrows?: boolean;
}

/**
 * Stands in for the browser surfaces the probe touches.
 *
 * happy-dom has no Web Audio, so every node is a spy and the worklet is driven
 * by the test rather than by an audio thread.
 */
function stubBrowser(options: BrowserStubOptions) {
  const track = {
    label: "Fake microphone",
    getSettings: () =>
      options.settings ?? {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    stop: vi.fn(),
  };
  const stream = {
    getAudioTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;

  const mediaDevices = {
    getUserMedia: options.getUserMedia ?? vi.fn().mockResolvedValue(stream),
    getSupportedConstraints: () => ({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    }),
  };
  const wakeLockSentinel = new FakeWakeLockSentinel();
  const wakeLock = { request: vi.fn().mockResolvedValue(wakeLockSentinel) };

  defineOn(
    navigator,
    "mediaDevices",
    options.mediaDevices === false ? undefined : mediaDevices,
  );
  defineOn(navigator, "wakeLock", wakeLock);
  vi.stubGlobal("isSecureContext", options.secure ?? true);

  const context = new FakeAudioContext();
  if (options.addModule)
    context.audioWorklet.addModule = vi.fn(options.addModule);
  vi.stubGlobal(
    "AudioContext",
    class {
      constructor() {
        if (options.audioContextThrows) throw new Error("Too many contexts");
        return context;
      }
    },
  );
  vi.stubGlobal("AudioWorkletNode", FakeWorkletNode);

  return { track, stream, mediaDevices, wakeLock, wakeLockSentinel, context };
}

/** Replaces a host-object property and queues its restore. */
function defineOn(host: object, key: string, value: unknown): void {
  const original = Object.getOwnPropertyDescriptor(host, key);
  Object.defineProperty(host, key, {
    configurable: true,
    value,
    writable: true,
  });
  restores.push(() => {
    if (original) Object.defineProperty(host, key, original);
    else Reflect.deleteProperty(host, key);
  });
}

class FakeWakeLockSentinel extends EventTarget {
  release = vi.fn().mockResolvedValue(undefined);
}

class FakeWorkletNode {
  port = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    close: vi.fn(),
  };
  connect = vi.fn((destination: unknown) => destination);
  disconnect = vi.fn();

  constructor() {
    workletNodes.push(this);
  }

  emit(data: unknown): void {
    this.port.onmessage?.({ data } as MessageEvent);
  }
}

class FakeAudioContext extends EventTarget {
  sampleRate = SAMPLE_RATE;
  baseLatency = 0.005;
  outputLatency = 0.02;
  currentTime = 0;
  state = "suspended";
  destination = {};
  audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
  resume = vi.fn(async () => {
    this.setState("running");
  });
  close = vi.fn(async () => {
    this.setState("closed");
  });
  createMediaStreamSource = vi.fn(() => ({
    connect: vi.fn((destination: unknown) => destination),
    disconnect: vi.fn(),
  }));
  createGain = vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn((destination: unknown) => destination),
    disconnect: vi.fn(),
  }));

  setState(state: string): void {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

function reportFixture(
  overrides: Partial<MicrophoneProbeReport>,
): MicrophoneProbeReport {
  return {
    version: 1,
    startedAt: "2026-01-01T00:00:00.000Z",
    userAgent: "test",
    secureContext: {
      secure: true,
      origin: "https://ma.local",
      protocol: "https:",
    },
    mediaApi: { mediaDevices: true, getUserMedia: true },
    constraints: constraintsFixture({}),
    audioContext: {
      sampleRate: SAMPLE_RATE,
      baseLatency: 0.005,
      outputLatency: 0.02,
    },
    capture: captureFixture({}),
    wakeLock: { supported: true, acquired: true, heldToEnd: true, error: null },
    contextState: { stayedRunning: true, transitions: [] },
    ...overrides,
  };
}

function constraintsFixture(
  overrides: Partial<NonNullable<MicrophoneProbeReport["constraints"]>>,
): NonNullable<MicrophoneProbeReport["constraints"]> {
  return {
    requested: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    applied: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    supported: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    honored: true,
    trackSettings: {},
    trackLabel: "Fake microphone",
    error: null,
    ...overrides,
  };
}

/**
 * A clean twenty-second window: 7500 quanta of 128 frames, which is exactly
 * what 20 s at 48 kHz should produce.
 *
 * The four derived fields are computed the way the composable computes them and
 * cannot be overridden, so no fixture can describe a reading the worklet and
 * the anchors could not have produced together. Drive them through
 * `measuredQuanta` or `measuredSeconds` instead.
 */
function captureFixture(
  overrides: CaptureOverrides,
): NonNullable<MicrophoneProbeReport["capture"]> {
  const base = {
    requestedSeconds: CAPTURE_SECONDS,
    measuredSeconds: 20,
    measuredQuanta: 7500,
    totalQuanta: 11250,
    leadInQuanta: 0,
    droppedQuanta: 0,
    unconnectedQuanta: 0,
    peakAmplitude: 0.21,
    started: true,
    aborted: false,
    error: null,
    ...overrides,
  };
  const framesDelivered = base.measuredQuanta * RENDER_QUANTUM;
  const expectedFrames = SAMPLE_RATE * base.measuredSeconds;
  return {
    ...base,
    framesDelivered,
    expectedFrames,
    renderSeconds: framesDelivered / SAMPLE_RATE,
    discrepancyPpm: ((framesDelivered - expectedFrames) / expectedFrames) * 1e6,
  };
}
