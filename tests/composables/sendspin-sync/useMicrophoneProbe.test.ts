import {
  CAPTURE_SECONDS,
  summariseProbe,
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

describe("summariseProbe", () => {
  it("calls an insecure origin blocked rather than a device failure", () => {
    const summary = summariseProbe(
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
    const summary = summariseProbe(
      reportFixture({
        constraints: constraintsFixture({
          applied: {
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: false,
          },
          honoured: false,
        }),
      }),
    );

    expect(summary.checks.voice_processing).toBe("fail");
    expect(summary.verdict).toBe("unsupported");
  });

  it("only warns when a constraint was never reported back", () => {
    const summary = summariseProbe(
      reportFixture({
        constraints: constraintsFixture({
          applied: { noiseSuppression: false, autoGainControl: false },
          honoured: false,
        }),
      }),
    );

    expect(summary.checks.voice_processing).toBe("warn");
    expect(summary.verdict).toBe("degraded");
  });

  it("warns on a drifting clock and on skipped quanta", () => {
    const drifting = summariseProbe(
      reportFixture({ capture: captureFixture({ discrepancyPpm: -2500 }) }),
    );
    const gapped = summariseProbe(
      reportFixture({
        capture: captureFixture({ gapCount: 1, missingFrames: 256 }),
      }),
    );

    expect(drifting.checks.capture).toBe("warn");
    expect(gapped.checks.capture).toBe("warn");
  });

  it("reports a clean run as ready", () => {
    const summary = summariseProbe(reportFixture({}));

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

    expect(probe.report.value?.constraints?.error).toBe(
      "NotAllowedError: Denied",
    );
    expect(probe.report.value?.capture).toBeNull();
    expect(browser.context.close).toHaveBeenCalled();
    expect(browser.track.stop).toHaveBeenCalledTimes(0);

    // A refusal is a permission problem, not a verdict on the microphone.
    const summary = summariseProbe(probe.report.value!);
    expect(summary.verdict).toBe("blocked");
    expect(summary.checks.voice_processing).toBe("not_evaluated");
  });

  it("reports the applied constraints and the measured frame drift", async () => {
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
    worklet.emit({ frames: 0, quanta: 0, contextTime: 0, gaps: [] });

    // Two thirds of the way in, the audio clock is 1000 ppm ahead.
    await vi.advanceTimersByTimeAsync(20_000);
    worklet.emit({
      frames: SAMPLE_RATE * 20 + SAMPLE_RATE * 20 * 1e-3,
      quanta: 7500,
      contextTime: 20,
      gaps: [{ atFrame: 480_000, missingFrames: 256 }],
    });

    await vi.advanceTimersByTimeAsync(CAPTURE_SECONDS * 1000 - 20_000);
    await pending;

    const report = probe.report.value;
    expect(report?.constraints?.applied).toEqual({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: true,
    });
    expect(report?.constraints?.honoured).toBe(false);
    expect(report?.audioContext).toEqual({
      sampleRate: SAMPLE_RATE,
      baseLatency: 0.005,
      outputLatency: 0.02,
    });
    expect(report?.capture?.measuredSeconds).toBeCloseTo(20, 3);
    expect(report?.capture?.discrepancyPpm).toBeCloseTo(1000, 3);
    expect(report?.capture?.gapCount).toBe(1);
    expect(report?.capture?.missingFrames).toBe(256);
    expect(report?.contextState?.stayedRunning).toBe(true);
    expect(summariseProbe(report!).verdict).toBe("unsupported");

    // The microphone must never outlive the run.
    expect(browser.track.stop).toHaveBeenCalledOnce();
    expect(browser.context.close).toHaveBeenCalledOnce();
    expect(browser.wakeLockSentinel.release).toHaveBeenCalledOnce();
    expect(probe.running.value).toBe(false);
  });

  it("flags an audio context that left the running state", async () => {
    vi.useFakeTimers();
    const browser = stubBrowser({});

    const probe = withScope(() => useMicrophoneProbe());
    const pending = probe.run();
    await vi.advanceTimersByTimeAsync(0);

    browser.context.setState("interrupted" as AudioContextState);
    workletNodes[0].emit({ frames: 0, quanta: 0, contextTime: 0, gaps: [] });
    await vi.advanceTimersByTimeAsync(CAPTURE_SECONDS * 1000);
    await pending;

    expect(probe.report.value?.contextState?.stayedRunning).toBe(false);
    expect(probe.report.value?.capture?.error).toBe(
      "The worklet delivered no measurable frames",
    );
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
});

/** Runs a composable inside a scope the test tears down for it. */
function withScope<T>(factory: () => T): T {
  const scope = effectScope();
  const value = scope.run(factory)!;
  restores.push(() => scope.stop());
  return value;
}

interface BrowserStubOptions {
  secure?: boolean;
  mediaDevices?: boolean;
  getUserMedia?: () => Promise<MediaStream>;
  settings?: MediaTrackSettings;
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
  const wakeLockSentinel = { release: vi.fn().mockResolvedValue(undefined) };
  const wakeLock = {
    request: vi.fn().mockResolvedValue(wakeLockSentinel),
  };

  defineOn(
    navigator,
    "mediaDevices",
    options.mediaDevices === false ? undefined : mediaDevices,
  );
  defineOn(navigator, "wakeLock", wakeLock);
  vi.stubGlobal("isSecureContext", options.secure ?? true);

  const context = new FakeAudioContext();
  vi.stubGlobal(
    "AudioContext",
    class {
      constructor() {
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
  state: AudioContextState = "suspended";
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

  setState(state: AudioContextState): void {
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
    wakeLock: { supported: true, acquired: true, error: null },
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
    honoured: true,
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
    framesDelivered: SAMPLE_RATE * CAPTURE_SECONDS,
    expectedFrames: SAMPLE_RATE * CAPTURE_SECONDS,
    discrepancyPpm: 0,
    quanta: 11250,
    gapCount: 0,
    missingFrames: 0,
    error: null,
    ...overrides,
  };
}
