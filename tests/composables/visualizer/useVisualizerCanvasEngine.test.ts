/**
 * A covered canvas holds no engine and no relay; following the viewed player
 * must not quietly bring the relay back until the canvas is uncovered.
 */
import { useVisualizerCanvasEngine } from "@/composables/visualizer/useVisualizerCanvasEngine";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, ref } from "vue";

const relayInstances = vi.hoisted(() => [] as { connect: () => void }[]);

vi.mock("@/plugins/visualizer-relay", () => ({
  VisualizerRelayClient: class {
    connect = vi.fn();
    close = vi.fn();
    currentFrame = vi.fn(() => null);
    constructor() {
      relayInstances.push(this);
    }
  },
  reportVisualizerCapability: vi.fn(),
}));

vi.mock("@/composables/visualizer/useVisualizerEngine", () => ({
  createVisualizerEngine: vi.fn(async () => ({
    destroy: vi.fn(),
    setPaused: vi.fn(),
    renderer: "test",
  })),
}));

vi.mock("@/composables/visualizer/state", () => ({
  currentVisualizerPreset: { value: null },
}));

vi.mock("@/plugins/api", async () => {
  const { ref } = await import("vue");
  const api = { isRemoteConnection: ref(false) };
  return { default: api, api };
});

vi.mock("@/plugins/auth", () => ({
  authManager: { isDashboardViewer: () => false },
}));

const connectCalls = () =>
  relayInstances.reduce(
    (total, relay) => total + vi.mocked(relay.connect).mock.calls.length,
    0,
  );

describe("useVisualizerCanvasEngine relay", () => {
  const covered = ref(false);
  const playerId = ref("p1");

  beforeEach(() => {
    relayInstances.length = 0;
    covered.value = false;
    playerId.value = "p1";
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mountHost = async () => {
    const Host = defineComponent({
      setup() {
        const canvas = ref(document.createElement("canvas"));
        Object.defineProperties(canvas.value, {
          clientWidth: { value: 100 },
          clientHeight: { value: 100 },
        });
        useVisualizerCanvasEngine({
          canvas,
          playerId: () => playerId.value,
          covered: () => covered.value,
          quality: () => "medium",
          applyPreset: async () => {},
          applyPalette: () => {},
          paused: () => false,
          onDownbeat: () => {},
        });
        return () => null;
      },
    });
    const wrapper = mount(Host);
    await flushPromises();
    return wrapper;
  };

  it("does not reconnect the relay for a player switch while covered", async () => {
    const wrapper = await mountHost();
    expect(connectCalls()).toBe(1);

    covered.value = true;
    await nextTick();
    playerId.value = "p2";
    await flushPromises();
    expect(connectCalls()).toBe(1);

    covered.value = false;
    await flushPromises();
    expect(connectCalls()).toBe(2);
    wrapper.unmount();
  });
});
