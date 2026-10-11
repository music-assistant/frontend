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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ZERO_LEVEL = 0x80;

const loadPreset = vi.hoisted(() => vi.fn());
const loseGLContext = vi.hoisted(() => vi.fn());
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
  });
  // Named as well as default: the module probe reads both, and vitest throws
  // on an export a mock does not define. The capability flags are read
  // unguarded, so they have to be present even when false.
  return {
    createVisualizer,
    supportsPaletteColors: false,
    supportsPaletteRamp: false,
    default: { createVisualizer, supportsPaletteColors: false },
  };
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

  // Every engine holds its own WebGL2 context and the adaptive ladder rebuilds
  // routinely; Chrome drops the oldest live context once they pile up.
  it("releases the GL context on destroy", () => {
    engine!.destroy();
    engine = null;

    expect(loseGLContext).toHaveBeenCalled();
  });
});
