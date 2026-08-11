import {
  CAPTURE_SECONDS,
  summarizeProbe,
  useMicrophoneProbe,
  type MicrophoneProbeReport,
} from "@/composables/sendspin-sync/useMicrophoneProbe";
import { effectScope } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SAMPLE_RATE = 48000;

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

  it("warns on either drift reading and on a quantum with no input", () => {
    const frames = summarizeProbe(
      reportFixture({
        capture: captureFixture({ frameDiscrepancyPpm: -2500 }),
      }),
    );
    const clock = summarizeProbe(
      reportFixture({ capture: captureFixture({ clockDriftPpm: 4000 }) }),
    );
    const silent = summarizeProbe(
      reportFixture({ capture: captureFixture({ silentQuanta: 3 }) }),
    );

    expect(frames.checks.capture).toBe("warn");
    expect(clock.checks.capture).toBe("warn");
    expect(silent.checks.capture).toBe("warn");
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
    expect(summarizeProbe(probe.report.value!).checks.capture).toBe("fail");
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
    worklet.emit({ frames: 0, quanta: 0, silentQuanta: 0, contextTime: 0 });

    // Two thirds of the way in, the audio thread has delivered 1000 ppm more
    // frames than its own clock accounts for, and that clock in turn has
    // fallen 1000 ppm behind the wall clock.
    await vi.advanceTimersByTimeAsync(20_000);
    worklet.emit({
      frames: SAMPLE_RATE * 19.98 * (1 + 1e-3),
      quanta: 7492,
      silentQuanta: 0,
      contextTime: 19.98,
    });

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
    expect(report?.capture?.renderSeconds).toBeCloseTo(19.98, 6);
    expect(report?.capture?.frameDiscrepancyPpm).toBeCloseTo(1000, 3);
    expect(report?.capture?.clockDriftPpm).toBeCloseTo(-1000, 3);
    expect(report?.capture?.quanta).toBe(7492);
    expect(report?.capture?.silentQuanta).toBe(0);
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
    workletNodes[0].emit({
      frames: 0,
      quanta: 0,
      silentQuanta: 0,
      contextTime: 0,
    });
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
    workletNodes[0].emit({
      frames: 0,
      quanta: 0,
      silentQuanta: 0,
      contextTime: 0,
    });
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

function captureFixture(
  overrides: Partial<NonNullable<MicrophoneProbeReport["capture"]>>,
): NonNullable<MicrophoneProbeReport["capture"]> {
  return {
    requestedSeconds: CAPTURE_SECONDS,
    measuredSeconds: CAPTURE_SECONDS,
    renderSeconds: CAPTURE_SECONDS,
    framesDelivered: SAMPLE_RATE * CAPTURE_SECONDS,
    expectedFrames: SAMPLE_RATE * CAPTURE_SECONDS,
    frameDiscrepancyPpm: 0,
    silentQuanta: 0,
    quanta: 11250,
    clockDriftPpm: 0,
    error: null,
    ...overrides,
  };
}
