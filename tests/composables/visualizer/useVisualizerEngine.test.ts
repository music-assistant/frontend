/**
 * The render loop is what makes a preset move, so pausing has to stop it and
 * not merely feed it silence. These cover the envelope either side of that:
 * the waveform ramping away before the loop halts, and building back up when
 * playback returns.
 */
import {
  ATTACK_MS,
  createVisualizerEngine,
  DECAY_MS,
  type VisualizerEngine,
} from "@/composables/visualizer/useVisualizerEngine";
import {
  getPreset,
  randomPresetName,
} from "@/helpers/visualizer/presetLibrary";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ZERO_LEVEL = 0x80;

const loadPreset = vi.hoisted(() => vi.fn(async () => true));
const loseGLContext = vi.hoisted(() => vi.fn());
const setPaletteColors = vi.hoisted(() => vi.fn());
const setPaletteRamp = vi.hoisted(() => vi.fn());
const renderedSamples = vi.hoisted(() => [] as Uint8Array[]);

vi.mock("butterchurn", () => {
  const createVisualizer = () => ({
    // The engine hands the same scratch buffer to every scaled render, so the
    // samples have to be copied as they arrive.
    render: ({ audioLevels }: { audioLevels: { timeByteArray: Uint8Array } }) =>
      renderedSamples.push(new Uint8Array(audioLevels.timeByteArray)),
    loadPreset,
    setRendererSize: vi.fn(),
    loseGLContext,
    setPaletteColors,
    setPaletteRamp,
  });
  // Named as well as default: the module probe reads both, and vitest throws
  // on an export a mock does not define.
  return { createVisualizer, default: { createVisualizer } };
});

vi.mock("@/helpers/visualizer/presetLibrary", () => ({
  getPreset: vi.fn(async () => ({})),
  randomPresetName: vi.fn(async () => "preset"),
}));

// Loudest possible waveform, so any attenuation is obvious.
const LOUD = new Uint8Array(1024).fill(0xff);

// How far the frame swings from silence: 0 once fully wound down.
const amplitude = (frame: Uint8Array) => frame[0] - ZERO_LEVEL;

let now = 0;
let frameCallbacks: FrameRequestCallback[] = [];
let resizeCallback: (() => void) | undefined;

// Run every frame the loop has queued; each one queues its successor.
const tick = () => {
  const due = frameCallbacks;
  frameCallbacks = [];
  for (const callback of due) callback(now);
};

const advance = (ms: number) => {
  now += ms;
};

describe("createVisualizerEngine pause envelope", () => {
  let engine: VisualizerEngine | null;

  beforeEach(async () => {
    now = 0;
    frameCallbacks = [];
    renderedSamples.length = 0;
    vi.clearAllMocks();
    vi.spyOn(performance, "now").mockImplementation(() => now);
    // jsdom has no WebGL2, and the support probe is what gates the engine.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      {} as unknown as RenderingContext,
    );
    vi.stubGlobal("AudioContext", class {});
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      frameCallbacks = [];
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resizeCallback = callback;
        }
        observe() {}
        disconnect() {}
      },
    );

    engine = await createVisualizerEngine(
      document.createElement("canvas"),
      () => LOUD,
    );
  });

  afterEach(() => {
    engine?.destroy();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the frames it is given while playing", () => {
    tick();

    expect(renderedSamples).toHaveLength(1);
    expect(amplitude(renderedSamples[0])).toBe(0x7f);
  });

  it("ramps the waveform away and then stops rendering", () => {
    tick();
    engine!.setPaused(true);

    advance(DECAY_MS / 2);
    tick();
    const midway = amplitude(renderedSamples.at(-1)!);
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(0x7f);

    advance(DECAY_MS / 2);
    tick();
    expect(amplitude(renderedSamples.at(-1)!)).toBe(0);

    // The loop is done: nothing is queued, so nothing renders again.
    const total = renderedSamples.length;
    tick();
    tick();
    expect(renderedSamples).toHaveLength(total);
  });

  it("builds back up when playback resumes", () => {
    engine!.setPaused(true);
    advance(DECAY_MS);
    tick();
    const halted = renderedSamples.length;

    engine!.setPaused(false);
    advance(ATTACK_MS / 4);
    tick();
    expect(renderedSamples.length).toBeGreaterThan(halted);
    const early = amplitude(renderedSamples.at(-1)!);
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(0x7f);

    advance(ATTACK_MS);
    tick();
    expect(amplitude(renderedSamples.at(-1)!)).toBe(0x7f);
  });

  it("halts on the spot when asked not to ramp", () => {
    tick();
    const total = renderedSamples.length;

    engine!.setPaused(true, false);
    tick();

    expect(renderedSamples).toHaveLength(total);
  });

  it("puts a frame back up when the canvas is resized while halted", () => {
    engine!.setPaused(true);
    advance(DECAY_MS);
    tick();
    const halted = renderedSamples.length;

    // A resize clears the drawing buffer, and no loop is running to redraw it.
    Object.defineProperty(HTMLCanvasElement.prototype, "clientWidth", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "clientHeight", {
      configurable: true,
      value: 600,
    });
    resizeCallback?.();

    expect(renderedSamples).toHaveLength(halted + 1);
    expect(amplitude(renderedSamples.at(-1)!)).toBe(0);
  });

  it("swaps presets without a blend while halted", async () => {
    engine!.setPaused(true, false);
    await engine!.loadPresetByName("preset", 2.7);

    expect(loadPreset).toHaveBeenCalledWith(expect.anything(), 0);
  });

  it("reports the preset it loaded", async () => {
    expect(await engine!.loadPresetByName("known")).toBe("known");
  });

  it("falls back to a random preset when the name is gone", async () => {
    vi.mocked(getPreset).mockResolvedValueOnce(undefined);

    expect(await engine!.loadPresetByName("dropped")).toBe("preset");
    expect(loadPreset).toHaveBeenCalled();
  });

  it("loads nothing when no preset is available", async () => {
    vi.mocked(getPreset).mockResolvedValueOnce(undefined);
    vi.mocked(randomPresetName).mockResolvedValueOnce("");

    expect(await engine!.loadPresetByName("dropped")).toBe("");
    expect(loadPreset).not.toHaveBeenCalled();
  });

  it("reports nothing when the engine fails to load the preset", async () => {
    loadPreset.mockResolvedValueOnce(false);

    expect(await engine!.loadPresetByName("known")).toBe("");
  });

  // Every engine holds its own WebGL2 context and rebuilds are routine;
  // Chrome drops the oldest live context once they pile up.
  it("releases the GL context on destroy", () => {
    engine!.destroy();
    engine = null;

    expect(loseGLContext).toHaveBeenCalled();
  });

  it("passes the artwork palette through to butterchurn", () => {
    const ramp: [number, number, number][] = [
      [0, 0, 0],
      [255, 255, 255],
    ];
    engine!.setPaletteColors([[1, 2, 3]]);
    engine!.setPaletteRamp(ramp, 0.5);

    expect(setPaletteColors).toHaveBeenCalledWith([[1, 2, 3]]);
    expect(setPaletteRamp).toHaveBeenCalledWith(ramp, 0.5);
  });

  it("ignores palette changes once destroyed", () => {
    engine!.destroy();
    engine!.setPaletteRamp(null, 0);

    expect(setPaletteRamp).not.toHaveBeenCalled();
    engine = null;
  });

  it("reports nothing when destroyed while the preset loads", async () => {
    let finishLoad!: (loaded: boolean) => void;
    loadPreset.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (finishLoad = resolve)),
    );

    const result = engine!.loadPresetByName("known");
    await vi.waitFor(() => expect(loadPreset).toHaveBeenCalled());
    engine!.destroy();
    finishLoad(true);

    expect(await result).toBe("");
  });
});

describe("createVisualizerEngine frame rate cap", () => {
  const MAX_FPS = 30;
  const DISPLAY_FRAME_MS = 1000 / 60;
  // nonzero, since a last render at 0 reads as never rendered
  const START_MS = 1000;
  let engine: VisualizerEngine | null;
  let visibility: DocumentVisibilityState;

  beforeEach(async () => {
    now = START_MS;
    frameCallbacks = [];
    renderedSamples.length = 0;
    vi.clearAllMocks();
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      {} as unknown as RenderingContext,
    );
    vi.stubGlobal("AudioContext", class {});
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      frameCallbacks = [];
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    // on the instance: happy-dom's document does not inherit the global Document
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });

    engine = await createVisualizerEngine(
      document.createElement("canvas"),
      () => LOUD,
      undefined,
      { maxFps: MAX_FPS },
    );
  });

  afterEach(() => {
    engine?.destroy();
    Reflect.deleteProperty(document, "visibilityState");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders every other tick of a 60 Hz display", () => {
    const expected = [true, false, true, false, true, false];
    const rendered: boolean[] = [];
    for (const _ of expected) {
      const before = renderedSamples.length;
      tick();
      rendered.push(renderedSamples.length > before);
      advance(DISPLAY_FRAME_MS);
    }

    expect(rendered).toEqual(expected);
  });

  it("renders on the first tick after the page is shown again", () => {
    tick();
    expect(renderedSamples).toHaveLength(1);

    visibility = "hidden";
    advance(DISPLAY_FRAME_MS / 2);
    tick();
    expect(renderedSamples).toHaveLength(1);

    // still inside the cap's interval, but the hidden tick reset it
    visibility = "visible";
    advance(DISPLAY_FRAME_MS / 2);
    tick();
    expect(renderedSamples).toHaveLength(2);
  });
});

describe("isVisualizerSupported", () => {
  // The verdict is cached per module load, so each case imports a fresh one.
  const probe = async () => {
    vi.resetModules();
    const module = await import("@/composables/visualizer/useVisualizerEngine");
    return module.isVisualizerSupported();
  };

  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      {} as unknown as RenderingContext,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("is supported with WebGL2 and WebAssembly", async () => {
    expect(await probe()).toBe(true);
  });

  it("is unsupported without WebAssembly", async () => {
    vi.stubGlobal("WebAssembly", undefined);

    expect(await probe()).toBe(false);
  });
});
