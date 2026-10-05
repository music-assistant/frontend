import { useShows } from "@/composables/ai-radio/useShows";
import { store as storeModule } from "@/plugins/store";
import { flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

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

vi.mock("@/plugins/api", () => ({
  default: { sendCommand, subscribe, getLibraryPlaylists: vi.fn() },
}));

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

vi.mock("@/plugins/store", async () => {
  const { reactive } = await import("vue");
  return { store: reactive({ enabledPlugins: new Set<string>() }) };
});

const store = storeModule as typeof storeModule & {
  enabledPlugins: ReadonlySet<string>;
};

function emit(event: string) {
  for (const listener of listeners) {
    listener({ object_id: "ai_radio", data: { event } });
  }
}

describe("useShows provider events", () => {
  it("ignores hints before anything was loaded", async () => {
    sendCommand.mockResolvedValue({ sessions: [] });
    store.enabledPlugins = new Set(["ai_radio"]);
    await flushPromises();
    expect(sendCommand).not.toHaveBeenCalled();
    expect(listeners).toHaveLength(1);

    emit("sessions_updated");
    emit("stations_updated");
    emit("sections_updated");
    await flushPromises();

    expect(sendCommand).not.toHaveBeenCalled();
  });

  it("refetches the status on sessions_updated once it was loaded", async () => {
    await useShows().loadStatus();
    sendCommand.mockClear();
    sendCommand.mockResolvedValue({
      sessions: [
        {
          session_id: "s1",
          station_id: "st1",
          queue_id: null,
          status: "running",
          created_at: "2026-10-05T10:00:00",
          started_at: null,
          ended_at: null,
          error: null,
          last_render_error: null,
        },
      ],
    });

    emit("sessions_updated");
    await flushPromises();

    expect(sendCommand).toHaveBeenCalledTimes(1);
    expect(sendCommand).toHaveBeenCalledWith("ai_radio/status");
    expect(useShows().sessions.value.map((s) => s.session_id)).toEqual(["s1"]);
  });

  it("refetches shows and sections on their hints, each on its own", async () => {
    sendCommand.mockResolvedValue([]);
    await useShows().loadShows();
    await useShows().loadSections();
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
    store.enabledPlugins = new Set();
    await flushPromises();
    expect(listeners).toHaveLength(0);

    store.enabledPlugins = new Set(["ai_radio"]);
    await flushPromises();
    expect(listeners).toHaveLength(1);
  });
});
