import { EventType } from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { reactive, ref } from "vue";

const listeners: Array<(event: unknown) => void> = [];
const subscribe = vi.fn(
  (_event: unknown, callback: (event: unknown) => void) => {
    listeners.push(callback);
    return () => {
      const index = listeners.indexOf(callback);
      if (index >= 0) listeners.splice(index, 1);
    };
  },
);

/** Imports the helper with fresh module state, api and store. */
async function setup() {
  vi.resetModules();
  subscribe.mockClear();
  listeners.length = 0;
  const state = ref("initialized");
  const store = reactive({ enabledPlugins: new Set(["ai_radio"]) });
  vi.doMock("@/plugins/api", () => ({
    default: { subscribe, state },
    ConnectionState: {
      INITIALIZED: "initialized",
      RECONNECTING: "reconnecting",
    },
  }));
  vi.doMock("@/plugins/store", () => ({ store }));
  const { trackAIRadioCache } = await import("@/helpers/ai_radio_events");
  return { trackAIRadioCache, state, store };
}

function emit(data: unknown) {
  for (const listener of listeners) listener({ object_id: "ai_radio", data });
}

const loader = () => vi.fn(async () => undefined);

describe("trackAIRadioCache", () => {
  it("subscribes to the ai_radio provider events only once a cache is tracked", async () => {
    const { trackAIRadioCache } = await setup();
    await flushPromises();
    expect(subscribe).not.toHaveBeenCalled();

    trackAIRadioCache("hosts_updated", loader());
    trackAIRadioCache("sessions_updated", loader());
    await flushPromises();

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith(
      EventType.PROVIDER_EVENT,
      expect.any(Function),
      "ai_radio",
    );
  });

  it("refetches only the cache a hint names and ignores anything else", async () => {
    const { trackAIRadioCache } = await setup();
    const loadHosts = loader();
    const loadQueueDj = loader();
    trackAIRadioCache("hosts_updated", loadHosts);
    trackAIRadioCache("queue_dj_updated", loadQueueDj);
    await flushPromises();
    // the loader that just filled its cache is not called again
    expect(loadHosts).not.toHaveBeenCalled();

    emit({ event: "hosts_updated" });
    emit({ event: "sessions_updated" });
    emit({ event: "game_updated", state: {} });
    emit(undefined);
    await flushPromises();

    expect(loadHosts).toHaveBeenCalledTimes(1);
    expect(loadQueueDj).not.toHaveBeenCalled();
  });

  it("resubscribes and refetches once when the plugin comes back", async () => {
    const { trackAIRadioCache, store } = await setup();
    const loadShows = loader();
    trackAIRadioCache("stations_updated", loadShows);
    await flushPromises();

    store.enabledPlugins = new Set();
    await flushPromises();
    expect(listeners).toHaveLength(0);

    store.enabledPlugins = new Set(["ai_radio"]);
    await flushPromises();
    expect(listeners).toHaveLength(1);
    expect(loadShows).toHaveBeenCalledTimes(1);
  });

  it("refetches every tracked cache after a reconnect, through the latest loader", async () => {
    const { trackAIRadioCache, state, store } = await setup();
    const staleLoader = loader();
    const loadHosts = loader();
    const loadStatus = vi.fn(async () => {
      throw new Error("Connection lost");
    });
    trackAIRadioCache("hosts_updated", staleLoader);
    trackAIRadioCache("hosts_updated", loadHosts);
    trackAIRadioCache("sessions_updated", loadStatus);

    state.value = "reconnecting";
    await flushPromises();
    expect(loadHosts).not.toHaveBeenCalled();

    state.value = "initialized";
    await flushPromises();

    expect(staleLoader).not.toHaveBeenCalled();
    expect(loadHosts).toHaveBeenCalledTimes(1);
    expect(loadStatus).toHaveBeenCalledTimes(1);

    // the plugin was disabled while the socket was down: its commands no longer exist
    store.enabledPlugins = new Set();
    state.value = "reconnecting";
    await flushPromises();
    state.value = "initialized";
    await flushPromises();
    expect(loadHosts).toHaveBeenCalledTimes(1);
  });
});
