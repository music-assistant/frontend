import type { store as storeModule } from "@/plugins/store";
import { flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { reactive, ref } from "vue";

const { sendCommand, subscribe, listeners } = vi.hoisted(() => {
  const listeners: Array<(event: unknown) => void> = [];
  return {
    sendCommand: vi.fn(),
    listeners,
    subscribe: vi.fn((_event: unknown, callback: (event: unknown) => void) => {
      listeners.push(callback);
      return () => {
        const index = listeners.indexOf(callback);
        if (index >= 0) listeners.splice(index, 1);
      };
    }),
  };
});

// a role without the queue DJ menu, so nothing prefetches on availability
vi.mock("@/plugins/auth", async () => {
  const { BUILTIN_ROLE_SCOPES, scopeChecker } =
    await import("../../fixtures/scopes");
  return {
    authManager: {
      guestSessionKind: () => null,
      hasScope: scopeChecker(BUILTIN_ROLE_SCOPES.guest),
    },
  };
});

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

/** Imports the composable with fresh module state and makes ai_radio available. */
async function setup() {
  vi.resetModules();
  sendCommand.mockReset();
  subscribe.mockClear();
  listeners.length = 0;
  // fresh api and store objects, so modules imported by earlier tests stop reacting
  vi.doMock("@/plugins/api", () => ({
    default: {
      sendCommand,
      subscribe,
      getLibraryPlaylists: vi.fn(),
      state: ref("initialized"),
    },
    ConnectionState: {
      INITIALIZED: "initialized",
      RECONNECTING: "reconnecting",
    },
  }));
  vi.doMock("@/plugins/store", () => ({
    store: reactive({ enabledPlugins: new Set<string>() }),
  }));
  const store = (await import("@/plugins/store"))
    .store as typeof storeModule & {
    enabledPlugins: ReadonlySet<string>;
  };
  const { default: api, ConnectionState } = await import("@/plugins/api");
  const { useShows } = await import("@/composables/ai-radio/useShows");
  store.enabledPlugins = new Set(["ai_radio"]);
  await flushPromises();
  return { shows: useShows(), store, api, ConnectionState };
}

function emit(event: string) {
  for (const listener of listeners) {
    listener({ object_id: "ai_radio", data: { event } });
  }
}

const runningSession = {
  session_id: "s1",
  station_id: "st1",
  queue_id: null,
  status: "running",
  created_at: "2026-10-05T10:00:00",
  started_at: null,
  ended_at: null,
  error: null,
  last_render_error: null,
};

describe("useShows provider events", () => {
  it("ignores hints before anything was loaded", async () => {
    await setup();
    expect(sendCommand).not.toHaveBeenCalled();
    expect(listeners).toHaveLength(1);

    emit("sessions_updated");
    emit("stations_updated");
    emit("sections_updated");
    await flushPromises();

    expect(sendCommand).not.toHaveBeenCalled();
  });

  it("refetches the status on sessions_updated once it was loaded", async () => {
    const { shows } = await setup();
    sendCommand.mockResolvedValue({ sessions: [] });
    await shows.loadStatus();
    sendCommand.mockClear();
    sendCommand.mockResolvedValue({ sessions: [runningSession] });

    emit("sessions_updated");
    await flushPromises();

    expect(sendCommand).toHaveBeenCalledTimes(1);
    expect(sendCommand).toHaveBeenCalledWith("ai_radio/status");
    expect(shows.sessions.value.map((s) => s.session_id)).toEqual(["s1"]);
  });

  it("refetches only the loaded caches after a reconnect", async () => {
    const { shows, api, ConnectionState } = await setup();
    sendCommand.mockResolvedValue({ sessions: [] });
    await shows.loadStatus();
    sendCommand.mockClear();

    api.state.value = ConnectionState.RECONNECTING;
    await flushPromises();
    expect(sendCommand).not.toHaveBeenCalled();

    api.state.value = ConnectionState.INITIALIZED;
    await flushPromises();

    expect(sendCommand.mock.calls.map((call) => call[0])).toEqual([
      "ai_radio/status",
    ]);
  });

  it("refetches shows and sections on their hints, each on its own", async () => {
    const { shows } = await setup();
    sendCommand.mockResolvedValue([]);
    await shows.loadShows();
    await shows.loadSections();
    sendCommand.mockClear();

    emit("stations_updated");
    await flushPromises();
    expect(sendCommand.mock.calls.map((call) => call[0])).toEqual([
      "ai_radio/stations/list",
    ]);

    sendCommand.mockClear();
    emit("sections_updated");
    await flushPromises();
    expect(sendCommand.mock.calls.map((call) => call[0])).toEqual([
      "ai_radio/sections/list",
    ]);
  });

  it("resubscribes once per availability flip", async () => {
    const { shows, store } = await setup();
    sendCommand.mockResolvedValue({ sessions: [] });
    await shows.loadStatus();
    sendCommand.mockResolvedValue([]);
    await shows.loadShows();
    await shows.loadSections();

    store.enabledPlugins = new Set();
    await flushPromises();
    expect(listeners).toHaveLength(0);

    sendCommand.mockClear();
    sendCommand.mockImplementation(async (command: string) =>
      command === "ai_radio/status" ? { sessions: [] } : [],
    );
    store.enabledPlugins = new Set(["ai_radio"]);
    await flushPromises();
    expect(listeners).toHaveLength(1);
    // the hints sent while the plugin was gone are refetched once it is back
    expect(sendCommand.mock.calls.map((call) => call[0]).sort()).toEqual([
      "ai_radio/sections/list",
      "ai_radio/stations/list",
      "ai_radio/status",
    ]);
  });
});
