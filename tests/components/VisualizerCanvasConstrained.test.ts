/**
 * A cast dashboard is the case the canvas cannot be told about in advance: it
 * runs as the dashboard viewer, so it tints in a shader instead of through the
 * CSS compositor and walks the adaptive ladder instead of trusting a quality
 * preference nobody can reach to change. These cover that wiring, which the
 * sibling suite deliberately mocks away by pinning isDashboardViewer to false.
 */
import VisualizerCanvas from "@/components/VisualizerCanvas.vue";
import type {
  VisualizerEngineOptions,
  VisualizerPerfSample,
} from "@/composables/visualizer/useVisualizerEngine";
import { ADAPTIVE_LADDER } from "@/helpers/visualizer/quality";
import { TV_TARGET_FPS } from "@/helpers/visualizer/adaptiveQuality";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type ColorCallback = (palette: Record<string, unknown>) => void;
type StateCallback = (state: string) => void;

const relayCallbacks = vi.hoisted(
  () => ({}) as { onColor?: ColorCallback; onState?: StateCallback },
);
vi.mock("@/plugins/visualizer-relay", () => ({
  VisualizerRelayClient: class {
    constructor(callbacks: Record<string, unknown>) {
      Object.assign(relayCallbacks, callbacks);
    }
    connect() {}
    close() {}
    currentFrame() {
      return null;
    }
    reportError() {}
  },
  installVisualizerErrorReporting: vi.fn(),
  reportVisualizerCapability: vi.fn(async () => {}),
  reportVisualizerRender: vi.fn(async () => {}),
  visualizerCanRender: () => true,
  visualizerProviderAvailable: () => true,
  visualizerShownOnDashboards: vi.fn(async () => true),
}));

vi.mock("@/plugins/auth", () => ({
  authManager: { isDashboardViewer: () => true },
}));

vi.mock("@/plugins/router", () => ({
  default: {
    currentRoute: { value: { path: "/now-playing", query: {} } },
  },
}));

const engine = vi.hoisted(() => ({
  loadPresetByName: vi.fn(async () => {}),
  loadRandomPreset: vi.fn(async () => "preset"),
  setPaused: vi.fn(),
  setProfile: vi.fn(),
  setTint: vi.fn(),
  setPaletteColors: vi.fn(),
  setPaletteRamp: vi.fn(),
  destroy: vi.fn(),
  renderer: "stub gpu",
  shaderTintActive: true,
  paletteColorsSupported: false,
  paletteRampSupported: true,
}));
const createVisualizerEngine = vi.hoisted(() => vi.fn());
vi.mock(
  "@/composables/visualizer/useVisualizerEngine",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    isVisualizerSupported: () => true,
    createVisualizerEngine,
  }),
);

vi.mock("@/composables/userPreferences", () => ({
  useUserPreferences: () => ({
    getPreference: (_key: string, fallback: unknown) => ({ value: fallback }),
  }),
  setUserPreference: vi.fn(),
}));

vi.mock("@/helpers/visualizer/presetLibrary", () => ({
  randomPresetName: vi.fn(async () => "preset"),
}));

vi.mock("@/plugins/api", async () => {
  const { reactive } = await import("vue");
  return {
    default: {
      isRemoteConnection: { value: false },
      players: reactive({}),
      supportsDashboardVisualizer: true,
      sendCommand: vi.fn(async () => ({})),
      subscribe: vi.fn(),
    },
  };
});

vi.mock("@/plugins/store", () => ({ store: { showFullscreenPlayer: false } }));

vi.mock("@/plugins/vuetify", () => ({
  default: { theme: { current: { value: { dark: false } } } },
}));

// The options the canvas handed the engine on the most recent build.
const engineOptions = (): VisualizerEngineOptions =>
  createVisualizerEngine.mock.lastCall![3] as VisualizerEngineOptions;

const feed = (sample: Partial<VisualizerPerfSample>) =>
  engineOptions().onPerfSample!({
    fps: 40,
    targetFps: 40,
    lateRatio: 0,
    pixels: 1_000_000,
    renderMs: 5,
    blockedRatio: 0,
    preset: "some preset",
    ...sample,
  });

// warm-up samples are ignored outright, so every test has to clear them first
const warmUp = () => {
  for (let i = 0; i < 3; i++) feed({});
};

const mountCanvas = async () => {
  const wrapper = mount(VisualizerCanvas, { props: { playerId: "p1" } });
  await flushPromises();
  return wrapper;
};

describe("VisualizerCanvas on a cast dashboard", () => {
  beforeAll(() => {
    for (const dimension of ["clientWidth", "clientHeight"]) {
      Object.defineProperty(HTMLCanvasElement.prototype, dimension, {
        configurable: true,
        value: 640,
      });
    }
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
    engine.paletteColorsSupported = false;
    createVisualizerEngine.mockImplementation(async () => engine);
  });

  it("renders on the adaptive ladder, not the quality preference", async () => {
    await mountCanvas();
    expect(createVisualizerEngine.mock.lastCall![2]).toBe(ADAPTIVE_LADDER[1]);
  });

  it("paces to the TV target and tints in a shader", async () => {
    await mountCanvas();
    const options = engineOptions();
    expect(options.maxFps).toBe(TV_TARGET_FPS);
    expect(options.shaderTint).toBe(true);
    expect(options.onPerfSample).toBeTypeOf("function");
  });

  it("resizes in place rather than rebuilding when the ladder steps", async () => {
    await mountCanvas();
    warmUp();
    const builds = createVisualizerEngine.mock.calls.length;
    // two struggling samples in a row is what the controller steps on
    feed({ fps: 20 });
    feed({ fps: 20 });
    expect(engine.setProfile).toHaveBeenCalledWith(ADAPTIVE_LADDER[2]);
    expect(createVisualizerEngine).toHaveBeenCalledTimes(builds);
  });

  it("reports every ladder move, for a display with no console", async () => {
    const { reportVisualizerRender } =
      await import("@/plugins/visualizer-relay");
    await mountCanvas();
    warmUp();
    feed({ fps: 20 });
    feed({ fps: 20 });
    expect(reportVisualizerRender).toHaveBeenCalledWith(
      expect.objectContaining({ fps: 20 }),
      1,
      "stepped down",
    );
  });

  it("hands the engine palette ramp anchors ordered dark to light", async () => {
    await mountCanvas();
    relayCallbacks.onColor!({
      background_light: [240, 240, 240],
      primary: [200, 0, 0],
      accent: [0, 0, 255],
      on_light: [20, 20, 20],
    });
    await flushPromises();
    expect(engine.setPaletteRamp).toHaveBeenLastCalledWith(
      [
        [20, 20, 20],
        [0, 0, 255],
        [200, 0, 0],
        [240, 240, 240],
      ],
      0.75,
    );
  });

  it("drops the flat tint while the ramp is doing the recoloring", async () => {
    await mountCanvas();
    relayCallbacks.onColor!({
      background_light: [240, 240, 240],
      primary: [200, 0, 0],
      accent: [0, 0, 255],
      on_light: [20, 20, 20],
    });
    await flushPromises();
    // the ramp replaces the tint rather than stacking with it
    expect(engine.setTint).toHaveBeenLastCalledWith(null);
  });

  it("colors the preset's own elements without being asked to", async () => {
    // on by default, so a supporting engine gets the colors with no preference
    // written; only one side of the palette is ever used
    engine.paletteColorsSupported = true;
    await mountCanvas();
    relayCallbacks.onColor!({
      primary: [200, 0, 0],
      accent: [0, 0, 255],
      on_dark: [10, 10, 10],
      on_light: [240, 240, 240],
    });
    await flushPromises();
    // waveform, outer border, inner border, motion vectors
    expect(engine.setPaletteColors).toHaveBeenLastCalledWith([
      [10, 10, 10],
      [200, 0, 0],
      [0, 0, 255],
      [10, 10, 10],
    ]);
  });

  it("keeps the CSS tint layer out of the DOM while the engine tints", async () => {
    const wrapper = await mountCanvas();
    relayCallbacks.onState!("streaming");
    await flushPromises();
    expect(wrapper.find(".visualizer-layer__tint").exists()).toBe(false);
  });
});
