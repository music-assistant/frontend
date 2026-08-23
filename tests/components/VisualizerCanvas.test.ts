/**
 * The canvas must not open a relay connection before its hosting view has
 * resolved which player it shows: the server picks a player itself when none
 * is named, so an early connection would visualize a different player's audio
 * for as long as the id takes to arrive.
 */
import VisualizerCanvas from "@/components/VisualizerCanvas.vue";
import api from "@/plugins/api";
import { PlaybackState } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const relayConstructor = vi.hoisted(() => vi.fn());
const relayClose = vi.hoisted(() => vi.fn());
vi.mock("@/plugins/visualizer-relay", () => ({
  VisualizerRelayClient: class {
    constructor(...args: unknown[]) {
      relayConstructor(...args);
    }
    connect() {}
    close() {
      relayClose();
    }
    currentFrame() {
      return null;
    }
    reportError() {}
  },
  reportVisualizerCapability: vi.fn(async () => {}),
  visualizerCanRender: () => true,
  visualizerProviderAvailable: () => true,
  visualizerShownOnDashboards: vi.fn(async () => true),
}));

vi.mock("@/plugins/auth", () => ({
  authManager: { isDashboardViewer: () => false },
}));

const setPaused = vi.hoisted(() => vi.fn());
// The real module keeps the timing constants; only the engine itself is faked.
vi.mock(
  "@/composables/visualizer/useVisualizerEngine",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    isVisualizerSupported: () => true,
    createVisualizerEngine: vi.fn(async () => ({
      loadPresetByName: vi.fn(async () => {}),
      loadRandomPreset: vi.fn(async () => "preset"),
      setPaused,
      destroy: vi.fn(),
    })),
  }),
);

vi.mock("@/composables/userPreferences", () => ({
  useUserPreferences: () => ({
    getPreference: (_key: string, fallback: unknown) => ({ value: fallback }),
  }),
}));

vi.mock("@/helpers/visualizer/presetLibrary", () => ({
  randomPresetName: vi.fn(async () => "preset"),
}));

vi.mock("@/plugins/api", async () => {
  const { reactive } = await import("vue");
  return {
    default: { isRemoteConnection: { value: false }, players: reactive({}) },
  };
});

vi.mock("@/plugins/store", () => ({
  store: { showFullscreenPlayer: false },
}));

const themeIsDark = vi.hoisted(() => ({ value: false }));
vi.mock("@/plugins/vuetify", () => ({
  default: {
    theme: {
      current: {
        get value() {
          return { dark: themeIsDark.value };
        },
      },
    },
  },
}));

function mountCanvas(playerId: string) {
  return mount(VisualizerCanvas, { props: { playerId } });
}

describe("VisualizerCanvas relay connection", () => {
  beforeAll(() => {
    // jsdom lays everything out at zero, and the canvas defers startup until
    // it has real size; give it some so initialization runs.
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
  });

  it("waits for the player id instead of letting the server pick one", async () => {
    const wrapper = mountCanvas("");
    await flushPromises();

    expect(relayConstructor).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("connects as soon as the hosting view resolves the player", async () => {
    const wrapper = mountCanvas("");
    await flushPromises();

    await wrapper.setProps({ playerId: "kitchen" });
    await flushPromises();

    expect(relayConstructor).toHaveBeenCalledTimes(1);
    expect(relayConstructor.mock.calls[0][1]).toBe("kitchen");
    wrapper.unmount();
  });

  it("connects straight away when the player is known at mount", async () => {
    const wrapper = mountCanvas("kitchen");
    await flushPromises();

    expect(relayConstructor).toHaveBeenCalledTimes(1);
    expect(relayConstructor.mock.calls[0][1]).toBe("kitchen");
    wrapper.unmount();
  });

  it("follows the viewed player when it changes", async () => {
    const wrapper = mountCanvas("kitchen");
    await flushPromises();

    await wrapper.setProps({ playerId: "living_room" });
    await flushPromises();

    expect(relayConstructor).toHaveBeenCalledTimes(2);
    expect(relayConstructor.mock.calls[1][1]).toBe("living_room");
    wrapper.unmount();
  });
});

describe("VisualizerCanvas playback gating", () => {
  const player = () =>
    (api.players as Record<string, { playback_state: PlaybackState }>).kitchen;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (api.players as Record<string, { playback_state: PlaybackState }>).kitchen =
      { playback_state: PlaybackState.PLAYING };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("winds the visualizer down once the player stops playing", async () => {
    const wrapper = mountCanvas("kitchen");
    await flushPromises();

    player().playback_state = PlaybackState.PAUSED;
    await flushPromises();
    // Not yet: the settle delay has to pass first.
    expect(setPaused).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2000);
    expect(setPaused).toHaveBeenCalledWith(true);

    await flushPromises();
    expect(wrapper.get(".visualizer-layer").attributes("style")).toContain(
      "opacity: 0",
    );
    wrapper.unmount();
  });

  it("keeps rendering through a brief drop out of playing", async () => {
    const wrapper = mountCanvas("kitchen");
    await flushPromises();

    player().playback_state = PlaybackState.IDLE;
    await flushPromises();
    vi.advanceTimersByTime(200);
    player().playback_state = PlaybackState.PLAYING;
    await flushPromises();
    vi.advanceTimersByTime(2000);

    expect(setPaused).not.toHaveBeenCalledWith(true);
    wrapper.unmount();
  });

  it("resumes as soon as playback comes back", async () => {
    const wrapper = mountCanvas("kitchen");
    await flushPromises();

    player().playback_state = PlaybackState.PAUSED;
    await flushPromises();
    vi.advanceTimersByTime(2000);

    player().playback_state = PlaybackState.PLAYING;
    await flushPromises();

    expect(setPaused).toHaveBeenLastCalledWith(false);
    expect(wrapper.get(".visualizer-layer").attributes("style")).toContain(
      "opacity: 1",
    );
    wrapper.unmount();
  });

  it("starts up halted when the player is already paused", async () => {
    (api.players as Record<string, { playback_state: PlaybackState }>).kitchen =
      { playback_state: PlaybackState.PAUSED };

    const wrapper = mountCanvas("kitchen");
    await flushPromises();

    // No wind-down to run: there is nothing on screen yet.
    expect(setPaused).toHaveBeenCalledWith(true, false);
    wrapper.unmount();
  });
});

describe("VisualizerCanvas color tint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.players as Record<string, { playback_state: PlaybackState }>).kitchen =
      { playback_state: PlaybackState.PLAYING };
  });

  // Tint/scrim only show once streaming, like the relay's real onState.
  function emitStreaming() {
    const onState = relayConstructor.mock.calls.at(-1)?.[0]?.onState as
      | ((state: string) => void)
      | undefined;
    onState?.("streaming");
  }

  function emitColor(palette: Record<string, unknown>) {
    const onColor = relayConstructor.mock.calls.at(-1)?.[0]?.onColor as
      | ((palette: unknown) => void)
      | undefined;
    onColor?.(palette);
  }

  it("tints with on_dark in the light theme, like the OSD gradient", async () => {
    themeIsDark.value = false;
    const wrapper = mountCanvas("kitchen");
    await flushPromises();
    emitStreaming();
    emitColor({
      on_dark: [100, 180, 255],
      on_light: [10, 40, 90],
      primary: [10, 20, 30],
      accent: null,
    });
    await flushPromises();

    expect(
      wrapper.get(".visualizer-layer__tint").attributes("style"),
    ).toContain("#64b4ff");
    wrapper.unmount();
  });

  it("tints with on_light in the dark theme, like the OSD gradient", async () => {
    themeIsDark.value = true;
    const wrapper = mountCanvas("kitchen");
    await flushPromises();
    emitStreaming();
    emitColor({
      on_dark: [100, 180, 255],
      on_light: [10, 40, 90],
      primary: [10, 20, 30],
      accent: null,
    });
    await flushPromises();

    expect(
      wrapper.get(".visualizer-layer__tint").attributes("style"),
    ).toContain("#0a285a");
    themeIsDark.value = false;
    wrapper.unmount();
  });

  it("tints with on_light when the host forces the dark treatment", async () => {
    // the fullscreen player above 50% opacity builds its gradient from
    // on_light regardless of theme; the tint must not pick the other side
    themeIsDark.value = false;
    const wrapper = mount(VisualizerCanvas, {
      props: { playerId: "kitchen", forceDarkPalette: true },
    });
    await flushPromises();
    emitStreaming();
    emitColor({
      on_dark: [100, 180, 255],
      on_light: [10, 40, 90],
    });
    await flushPromises();

    expect(
      wrapper.get(".visualizer-layer__tint").attributes("style"),
    ).toContain("#0a285a");
    wrapper.unmount();
  });

  it("leaves the tint off when the themed pick is missing", async () => {
    // the OSD falls back to a flat grey rather than another palette entry, so
    // the honest equivalent here is no tint at all
    const wrapper = mountCanvas("kitchen");
    await flushPromises();
    emitStreaming();
    emitColor({ on_dark: null, on_light: [10, 40, 90], primary: [1, 2, 3] });
    await flushPromises();

    expect(
      wrapper.get(".visualizer-layer__tint").attributes("style"),
    ).toContain("transparent");
    wrapper.unmount();
  });

  it("fades tint and canvas as one isolated stack, per the opacity setting", async () => {
    // A tint outside the opacity-carrying stack would composite its own
    // raw color over the gradient background instead of blending.
    const wrapper = mount(VisualizerCanvas, {
      props: { playerId: "kitchen", opacity: 40 },
    });
    await flushPromises();
    emitStreaming();
    emitColor({ on_dark: [10, 20, 30] });
    await flushPromises();

    const stack = wrapper.get(".visualizer-layer__stack");
    expect(stack.attributes("style")).toContain("opacity: 0.4");
    expect(stack.find(".visualizer-layer__tint").exists()).toBe(true);
    expect(stack.find(".visualizer-layer__canvas").exists()).toBe(true);
    expect(
      wrapper.get(".visualizer-layer__canvas").attributes("style") ?? "",
    ).not.toContain("opacity");
    wrapper.unmount();
  });

  it("stays transparent when the relay has sent no color", async () => {
    const wrapper = mountCanvas("kitchen");
    await flushPromises();
    emitStreaming();
    await flushPromises();

    expect(
      wrapper.get(".visualizer-layer__tint").attributes("style"),
    ).toContain("transparent");
    wrapper.unmount();
  });

  it("resets the tint when the player changes, before the new relay speaks", async () => {
    const wrapper = mountCanvas("kitchen");
    await flushPromises();
    emitStreaming();
    emitColor({ on_dark: [10, 20, 30], accent: null });
    await flushPromises();
    expect(
      wrapper.get(".visualizer-layer__tint").attributes("style"),
    ).toContain("#0a141e");

    await wrapper.setProps({ playerId: "living_room" });
    await flushPromises();

    expect(
      wrapper.get(".visualizer-layer__tint").attributes("style"),
    ).toContain("transparent");
    wrapper.unmount();
  });
});
