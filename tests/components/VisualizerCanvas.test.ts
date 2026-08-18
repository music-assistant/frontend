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
}));

const setPaused = vi.hoisted(() => vi.fn());
vi.mock("@/composables/visualizer/useVisualizerEngine", () => ({
  isVisualizerSupported: () => true,
  DECAY_MS: 1500,
  ATTACK_MS: 1000,
  createVisualizerEngine: vi.fn(async () => ({
    loadPresetByName: vi.fn(async () => {}),
    loadRandomPreset: vi.fn(async () => "preset"),
    setPaused,
    destroy: vi.fn(),
  })),
}));

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
