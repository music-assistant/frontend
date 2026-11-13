/**
 * A cast dashboard is the case the canvas cannot be told about in advance: it
 * runs as the dashboard viewer, so it tints in a shader instead of through the
 * CSS compositor and walks the adaptive ladder instead of trusting a quality
 * preference nobody can reach to change. These cover that wiring, which the
 * sibling suite deliberately mocks away by pinning isDashboardViewer to false.
 */
import VisualizerCanvas from "@/components/VisualizerCanvas.vue";
import type { VisualizerEngineOptions } from "@/composables/visualizer/useVisualizerEngine";
import { TV_MAX_FPS, TV_PROFILE } from "@/helpers/visualizer/quality";
import { flushPromises, mount } from "@vue/test-utils";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

type ColorCallback = (palette: Record<string, unknown>) => void;
type StateCallback = (state: string) => void;

const relayCallbacks = vi.hoisted(
  () => ({}) as { onColor?: ColorCallback; onState?: StateCallback },
);
// every player id the canvas has opened a relay for, in order
const relayPlayerIds = vi.hoisted(() => [] as string[]);
vi.mock("@/plugins/visualizer-relay", () => ({
  VisualizerRelayClient: class {
    constructor(callbacks: Record<string, unknown>, playerId: string) {
      Object.assign(relayCallbacks, callbacks);
      relayPlayerIds.push(playerId);
    }
    connect() {}
    close() {}
    currentFrame() {
      return null;
    }
  },
  reportVisualizerCapability: vi.fn(async () => {}),
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
  loadPresetByName: vi.fn(async (name: string) => name),
  loadRandomPreset: vi.fn(async () => "preset"),
  setPaused: vi.fn(),
  setPaletteColors: vi.fn(),
  setPaletteRamp: vi.fn(),
  destroy: vi.fn(),
  renderer: "stub gpu",
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
    ConnectionState: {
      AUTHENTICATED: "authenticated",
      INITIALIZED: "initialized",
    },
    default: {
      state: { value: "authenticated" },
      isRemoteConnection: { value: false },
      players: reactive({}),
      sendCommand: vi.fn(async () => ({})),
      subscribe: vi.fn(),
    },
  };
});

vi.mock("@/plugins/store", () => ({ store: { showFullscreenPlayer: false } }));

vi.mock("@/composables/useThemePreference", () => ({
  isDark: { value: false },
}));

// The options the canvas handed the engine on the most recent build.
const engineOptions = (): VisualizerEngineOptions =>
  createVisualizerEngine.mock.lastCall![3] as VisualizerEngineOptions;

const mountCanvas = async () => {
  const wrapper = mount(VisualizerCanvas, { props: { playerId: "p1" } });
  await flushPromises();
  return wrapper;
};

describe("VisualizerCanvas on a cast dashboard", () => {
  const canvasDimensions = ["clientWidth", "clientHeight"] as const;
  const originalDimensions = canvasDimensions.map((dimension) =>
    Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, dimension),
  );

  beforeAll(() => {
    for (const dimension of canvasDimensions) {
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

  afterAll(() => {
    canvasDimensions.forEach((dimension, index) => {
      const original = originalDimensions[index];
      if (original) {
        Object.defineProperty(HTMLCanvasElement.prototype, dimension, original);
      } else {
        Reflect.deleteProperty(HTMLCanvasElement.prototype, dimension);
      }
    });
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    relayPlayerIds.length = 0;
    engine.paletteColorsSupported = false;
    createVisualizerEngine.mockImplementation(async () => engine);
  });

  // The butterchurn chunk is megabytes, and a cast receiver resolves its player
  // off the socket; the id landing mid-build must not lose the relay for good.
  it("connects the relay for a player that resolves while the engine builds", async () => {
    let releaseEngine = () => {};
    createVisualizerEngine.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseEngine = () => resolve(engine);
        }),
    );
    const wrapper = mount(VisualizerCanvas, { props: { playerId: "" } });
    await flushPromises();
    expect(relayPlayerIds).toEqual([]);

    await wrapper.setProps({ playerId: "p1" });
    releaseEngine();
    await flushPromises();

    expect(relayPlayerIds).toEqual(["p1"]);
  });

  it("renders on the fixed TV profile, not the quality preference", async () => {
    await mountCanvas();
    expect(createVisualizerEngine.mock.lastCall![2]).toBe(TV_PROFILE);
  });

  it("caps the render rate at the TV maximum", async () => {
    await mountCanvas();
    expect(engineOptions().maxFps).toBe(TV_MAX_FPS);
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

  it("colors the preset's own elements without being asked to", async () => {
    // on by default, so a supporting engine gets the colors with no preference
    // written; only one side of the palette is ever used
    engine.paletteColorsSupported = true;
    await mountCanvas();
    relayCallbacks.onColor!({
      primary: [200, 0, 0],
      accent: [0, 0, 255],
      // on_dark is the variant for drawing ON a dark background, so it is the
      // light-looking colour of the pair
      on_dark: [240, 240, 240],
      on_light: [10, 10, 10],
    });
    await flushPromises();
    // waveform, outer border, inner border, motion vectors. This suite runs on
    // the light theme, so the elements take the on-light variant.
    expect(engine.setPaletteColors).toHaveBeenLastCalledWith([
      [10, 10, 10],
      [200, 0, 0],
      [0, 0, 255],
      [10, 10, 10],
    ]);
  });
});
