import PartyDashboardView from "@/views/PartyDashboardView.vue";
import { type VueWrapper, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { storeMock } = vi.hoisted(() => ({
  storeMock: {
    frameless: false,
    activePlayerId: undefined as string | undefined,
    activePlayer: undefined,
    activePlayerQueue: undefined,
    curQueueItem: undefined,
  },
}));

vi.mock("@/plugins/store", () => ({ store: storeMock }));

vi.mock("@/plugins/api", () => ({
  default: {
    baseUrl: "",
    players: {},
    providers: {},
    queues: {},
    sendCommand: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn(() => () => undefined),
    getPlayerQueueItems: vi.fn().mockResolvedValue([]),
    getTrackLyrics: vi.fn().mockResolvedValue([null, null]),
  },
}));

// Pulled in transitively via @/helpers/utils; mocked so their module-load side effects (AuthManager reading localStorage) don't leak into this test.
vi.mock("@/plugins/router", () => ({ default: {} }));
vi.mock("@/plugins/auth", () => ({ authManager: {}, default: {} }));

vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));

// Only the theme read is stood in for; the dialog primitives further down the
// tree use the rest of the module for real.
vi.mock("@vueuse/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vueuse/core")>()),
  useColorMode: () => ({ value: "light" }),
}));

vi.mock("@/composables/usePartyConfig", () => ({
  usePartyConfig: () => ({
    config: { value: null },
    fetchConfig: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock("@/composables/visualizer/useVisualizer", () => ({
  useVisualizer: () => ({
    visualizerEnabledPref: { value: false },
    visualizerPresetPref: { value: "" },
    visualizerBlurPref: { value: 0 },
    visualizerOpacityPref: { value: 1 },
    visualizerAvailable: { value: false },
    visualizerActive: { value: false },
    toggleVisualizer: vi.fn(),
  }),
}));

vi.mock("@/composables/lyrics/useLyricsElapsedTime", () => ({
  useLyricsElapsedTime: () => ({ elapsedTime: { value: 0 } }),
}));

// The view drives the real Fullscreen API, which happy-dom does not implement,
// so it is stood up here as a small state machine that fires the same event the
// browser does.
let fullscreenElement: Element | null = null;
const requestFullscreen = vi.fn(() => {
  fullscreenElement = document.documentElement;
  document.dispatchEvent(new Event("fullscreenchange"));
  return Promise.resolve();
});
const exitFullscreen = vi.fn(() => {
  fullscreenElement = null;
  document.dispatchEvent(new Event("fullscreenchange"));
  return Promise.resolve();
});

const ButtonStub = { template: "<button><slot /></button>" };

let wrapper: VueWrapper | undefined;

async function mountView() {
  wrapper = mount(PartyDashboardView, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        Badge: { template: "<span><slot /></span>" },
        Button: ButtonStub,
        LyricsViewer: true,
        PartyQR: true,
        PartyTrackCard: true,
        ShowDashboardButton: true,
        VisualizerCanvas: true,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

const enterFullscreen = (view: VueWrapper) =>
  view.get('[aria-label="tooltip.enter_fullscreen"]').trigger("click");

describe("PartyDashboardView fullscreen", () => {
  beforeEach(() => {
    storeMock.frameless = false;
    fullscreenElement = null;
    requestFullscreen.mockClear();
    exitFullscreen.mockClear();
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    });
    document.documentElement.requestFullscreen = requestFullscreen;
    document.exitFullscreen = exitFullscreen;
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it("drops the app chrome when the dashboard goes fullscreen", async () => {
    const view = await mountView();

    await enterFullscreen(view);

    expect(storeMock.frameless).toBe(true);
    expect(requestFullscreen).toHaveBeenCalled();
  });

  it("hands the chrome back when the dashboard is left while fullscreen", async () => {
    // browser back skips the minimize button, so the view has to undo its own
    // fullscreen on the way out or the next route has no navigation at all
    const view = await mountView();
    await enterFullscreen(view);

    view.unmount();
    wrapper = undefined;

    expect(storeMock.frameless).toBe(false);
    expect(exitFullscreen).toHaveBeenCalled();
  });

  it("leaves a frameless session it did not start alone", async () => {
    // a dashboard viewer login and a ?frameless deep link are both meant to
    // stay frameless for the whole session
    storeMock.frameless = true;
    const view = await mountView();

    view.unmount();
    wrapper = undefined;

    expect(storeMock.frameless).toBe(true);
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it("stays out of the way once the browser has left fullscreen", async () => {
    const view = await mountView();
    await enterFullscreen(view);

    // Escape, which the browser reports as a fullscreen change
    fullscreenElement = null;
    document.dispatchEvent(new Event("fullscreenchange"));
    expect(storeMock.frameless).toBe(false);

    view.unmount();
    wrapper = undefined;

    expect(storeMock.frameless).toBe(false);
    expect(exitFullscreen).not.toHaveBeenCalled();
  });
});
