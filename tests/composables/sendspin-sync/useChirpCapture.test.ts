import { useChirpCapture } from "@/composables/sendspin-sync/useChirpCapture";
import { effectScope } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SAMPLE_RATE = 48000;

let workletNodes: FakeWorkletNode[] = [];
let restores: (() => void)[] = [];
let now = 0;

beforeEach(() => {
  workletNodes = [];
  restores = [];
  now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
});

afterEach(() => {
  for (const restore of restores.reverse()) restore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useChirpCapture", () => {
  it("opens one context and one stream for the whole run", async () => {
    const browser = stubBrowser();
    const capture = withScope(() => useChirpCapture());

    const opening = await capture.open();

    expect(opening.opened).toBe(true);
    expect(opening.sampleRate).toBe(SAMPLE_RATE);
    expect(browser.mediaDevices.getUserMedia).toHaveBeenCalledOnce();
    expect(capture.sampleRate.value).toBe(SAMPLE_RATE);

    // A second open must not build a second graph: every arrival is timed against
    // the frame counter in the first one.
    await capture.open();
    expect(browser.mediaDevices.getUserMedia).toHaveBeenCalledOnce();
  });

  it("reports a refused microphone instead of throwing into the tap", async () => {
    const browser = stubBrowser({
      getUserMedia: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("Denied"), { name: "NotAllowedError" }),
        ),
    });
    const capture = withScope(() => useChirpCapture());

    const opening = await capture.open();

    expect(opening.opened).toBe(false);
    expect(opening.error?.name).toBe("NotAllowedError");
    expect(browser.context.close).toHaveBeenCalledOnce();
    // Reported even though opening failed: whether the screen could be held awake
    // is worth knowing before the user tries again, and closing forgets it.
    expect(opening.wakeLock?.acquired).toBe(true);
    expect(browser.wakeLockSentinel.release).toHaveBeenCalledOnce();
  });

  it("hands back the recording it was asked for, timed on the frame counter", async () => {
    stubBrowser();
    const capture = withScope(() => useChirpCapture());
    await capture.open();

    const pending = capture.record(0.01);
    const node = workletNodes[0];
    expect(node.port.postMessage).toHaveBeenCalledWith({ armed: true });

    node.emit({
      startFrame: 96_000,
      dropouts: 0,
      lostFrames: 0,
      samples: Float32Array.from({ length: 600 }, (_, index) => index),
    });
    const recording = await pending;

    expect(recording).not.toBeNull();
    expect(recording!.firstFrame).toBe(96_000);
    expect(recording!.sampleRate).toBe(SAMPLE_RATE);
    expect(recording!.samples).toHaveLength(600);
    expect(node.port.postMessage).toHaveBeenLastCalledWith({ armed: false });
  });

  it("places a batch by its frame index, so a gap stays a gap", async () => {
    stubBrowser();
    const capture = withScope(() => useChirpCapture());
    await capture.open();

    const pending = capture.record(0.02);
    const node = workletNodes[0];
    node.emit({
      startFrame: 1000,
      dropouts: 0,
      lostFrames: 0,
      samples: Float32Array.from({ length: 128 }, () => 1),
    });
    // The next batch starts 128 frames later than it would if they were simply
    // appended: those frames were recorded by nobody and must stay empty.
    node.emit({
      startFrame: 1000 + 256,
      dropouts: 3,
      lostFrames: 128,
      samples: Float32Array.from({ length: 1000 }, () => 2),
    });
    const recording = await pending;

    expect(recording!.samples).toHaveLength(1256);
    expect(recording!.samples[127]).toBe(1);
    expect(recording!.samples[128]).toBe(0);
    expect(recording!.samples[255]).toBe(0);
    expect(recording!.samples[256]).toBe(2);
    // The tallies run from the moment the worklet was armed, so the last message
    // carries the whole recording's rather than that batch's own.
    expect(recording!.dropouts).toBe(3);
    expect(recording!.lostFrames).toBe(128);
  });

  it("gives up rather than hanging when the device stops delivering", async () => {
    vi.useFakeTimers();
    stubBrowser();
    const capture = withScope(() => useChirpCapture());
    await capture.open();

    const pending = capture.record(0.5);
    await vi.advanceTimersByTimeAsync(3000);

    // Nothing arrived at all, so there is no recording to report.
    expect(await pending).toBeNull();
  });

  it("voids the run when the context tells us it stopped", async () => {
    const browser = stubBrowser();
    const capture = withScope(() => useChirpCapture());
    await capture.open();
    expect(capture.voided.value).toBeNull();

    browser.context.setState("suspended");

    expect(capture.voided.value).toBe("suspended");
    expect(capture.contextStates.value).toContain("suspended");
  });

  it("voids the run when the audio clock quietly stops advancing", async () => {
    vi.useFakeTimers();
    const browser = stubBrowser();
    const capture = withScope(() => useChirpCapture());
    await capture.open();

    // The screen locked: wall time keeps running and the render clock does not,
    // and some browsers never fire a state change for it.
    now += 5000;
    browser.context.currentTime += 0.2;
    await vi.advanceTimersByTimeAsync(1000);

    expect(capture.voided.value).toBe("suspended");
  });

  it("does not mistake ordinary clock drift for a suspension", async () => {
    vi.useFakeTimers();
    const browser = stubBrowser();
    const capture = withScope(() => useChirpCapture());
    await capture.open();

    // Ten minutes at 1000 ppm — the worst a phone the probe still passes will do —
    // ticked at the real cadence.
    await runClock(browser, 600, 1000e-6);

    expect(capture.voided.value).toBeNull();
  });

  it("still catches a gap late in a long run", async () => {
    vi.useFakeTimers();
    const browser = stubBrowser();
    const capture = withScope(() => useChirpCapture());
    await capture.open();

    await runClock(browser, 480, 1000e-6);
    expect(capture.voided.value).toBeNull();

    // A two and a half second gap eight minutes in. Judged against the run so far
    // this is smaller than the drift already accumulated, so a cumulative
    // comparison cannot see it — which is why the check is per tick.
    now += 2500;
    await vi.advanceTimersByTimeAsync(1000);

    expect(capture.voided.value).toBe("suspended");
  });

  it("refuses to record once the run is void", async () => {
    const browser = stubBrowser();
    const capture = withScope(() => useChirpCapture());
    await capture.open();
    browser.context.setState("suspended");

    // The honest outcome is nothing at all: arrivals either side of the gap sit on
    // unrelated timelines, so a number derived from them would be made up.
    expect(await capture.record(0.01)).toBeNull();
  });

  it("releases the microphone, the graph and the wake lock on close", async () => {
    const browser = stubBrowser();
    const capture = withScope(() => useChirpCapture());
    await capture.open();

    await capture.close();

    expect(browser.track.stop).toHaveBeenCalledOnce();
    expect(browser.context.close).toHaveBeenCalledOnce();
    expect(browser.wakeLockSentinel.release).toHaveBeenCalledOnce();
    expect(workletNodes[0].port.close).toHaveBeenCalledOnce();
    expect(capture.opened.value).toBe(false);
  });

  it("releases everything when its scope goes away", async () => {
    const browser = stubBrowser();
    const scope = effectScope();
    const capture = scope.run(() => useChirpCapture())!;
    await capture.open();

    scope.stop();
    await Promise.resolve();
    await Promise.resolve();

    expect(browser.track.stop).toHaveBeenCalledOnce();
    expect(browser.context.close).toHaveBeenCalledOnce();
  });
});

/** Advance both clocks a second at a time, the render clock drifting by `ppm`. */
async function runClock(
  browser: { context: FakeAudioContext },
  seconds: number,
  ppm: number,
): Promise<void> {
  for (let tick = 0; tick < seconds; tick++) {
    now += 1000;
    browser.context.currentTime += 1 - ppm;
    await vi.advanceTimersByTimeAsync(1000);
  }
}

/** Runs a composable inside a scope the test tears down for it. */
function withScope<T>(factory: () => T): T {
  const scope = effectScope();
  const value = scope.run(factory)!;
  restores.push(() => scope.stop());
  return value;
}

interface BrowserStubOptions {
  getUserMedia?: () => Promise<MediaStream>;
}

/**
 * Stands in for the browser surfaces the capture touches.
 *
 * happy-dom has no Web Audio, so every node is a spy and the worklet is driven by
 * the test rather than by an audio thread.
 */
function stubBrowser(options: BrowserStubOptions = {}) {
  const track = {
    label: "Fake microphone",
    getSettings: () => ({}),
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

  defineOn(navigator, "mediaDevices", mediaDevices);
  defineOn(navigator, "wakeLock", wakeLock);
  vi.stubGlobal("isSecureContext", true);

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

class FakeWakeLockSentinel extends EventTarget {
  release = vi.fn().mockResolvedValue(undefined);
}

class FakeWorkletNode {
  port = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    postMessage: vi.fn(),
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
  currentTime = 0;
  state = "suspended";
  destination = {};
  audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
  resume = vi.fn(async () => {
    this.state = "running";
  });
  close = vi.fn(async () => {
    this.state = "closed";
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
