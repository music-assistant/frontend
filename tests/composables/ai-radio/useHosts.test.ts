import {
  EventType,
  PLAYER_CONTROL_NONE,
  PlayerType,
  type AIRadioHost,
  type Player,
  type PlayerQueue,
} from "@/plugins/api/interfaces";
import type { store as storeModule } from "@/plugins/store";
import { flushPromises } from "@vue/test-utils";
import { beforeAll, describe, expect, it, vi } from "vitest";
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

// signed in as a member
vi.mock("@/plugins/auth", async () => {
  const { BUILTIN_ROLE_SCOPES, scopeChecker } =
    await import("../../fixtures/scopes");
  return {
    authManager: {
      guestSessionKind: () => null,
      hasScope: scopeChecker(BUILTIN_ROLE_SCOPES.user),
    },
  };
});

vi.mock("@/plugins/router", () => ({
  default: { push: vi.fn() },
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: { emit: vi.fn() },
}));

vi.mock("@/helpers/sleep_timer", () => ({
  getSleepTimerMenuItem: vi.fn(),
  sleepTimerActive: () => false,
}));

vi.mock("@/composables/useAudioOverlay", () => ({
  useAudioOverlay: () => ({
    openOverlayDialog: vi.fn(),
    overlayAvailable: { value: false },
  }),
}));

vi.mock("vue-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// useShows subscribes too, so every hint goes to all listeners
function emit(event: string) {
  for (const listener of listeners) {
    listener({ object_id: "ai_radio", data: { event } });
  }
}

function callsOf(command: string) {
  return sendCommand.mock.calls.filter((call) => call[0] === command);
}

const host: AIRadioHost = {
  id: "host-1",
  name: "Robo DJ",
  instructions: "",
  tts_engine: "",
  language: "",
  options: {},
  section_ids: [],
  section_order: [],
  merge_section_id: "",
};

/** Imports the composables with fresh module state; ai_radio is not available yet. */
async function setup() {
  vi.resetModules();
  sendCommand.mockReset();
  sendCommand.mockImplementation(async (command: string) => {
    if (command === "ai_radio/hosts/list") return [host];
    if (command === "ai_radio/queue_dj/status") return { kitchen: "host-1" };
    return undefined;
  });
  subscribe.mockClear();
  listeners.length = 0;
  // fresh api and store objects, so modules imported by earlier tests stop reacting
  vi.doMock("@/plugins/api", () => ({
    default: {
      players: {},
      sendCommand,
      subscribe,
      state: ref("initialized"),
    },
    ConnectionState: {
      INITIALIZED: "initialized",
      RECONNECTING: "reconnecting",
    },
  }));
  // the store must be reactive here: the prefetch hangs off a watch on the
  // enabled plugins, which is exactly what these tests exercise.
  vi.doMock("@/plugins/store", () => ({
    store: reactive({ enabledPlugins: new Set<string>() }),
  }));
  // the real store computes these; on the mock they are plain writable state
  const store = (await import("@/plugins/store"))
    .store as typeof storeModule & {
    enabledPlugins: ReadonlySet<string>;
  };
  const { default: api, ConnectionState } = await import("@/plugins/api");
  const { useHosts } = await import("@/composables/ai-radio/useHosts");
  return { useHosts, store, api, ConnectionState };
}

/** Like setup, with ai_radio available and the prefetch settled. */
async function setupLoaded() {
  const context = await setup();
  context.store.enabledPlugins = new Set(["ai_radio"]);
  await flushPromises();
  sendCommand.mockClear();
  return context;
}

const player = {
  player_id: "kitchen",
  type: PlayerType.PLAYER,
  power_control: PLAYER_CONTROL_NONE,
  supported_features: [],
  source_list: [],
  sound_mode_list: [],
  options: [],
  needs_setup: false,
} as unknown as Player;

const queue = {
  queue_id: "kitchen",
  active: true,
  items: 0,
} as PlayerQueue;

// the menu helper's module graph takes seconds to transform the first time, so
// do that once here instead of inside a test's timeout
beforeAll(async () => {
  await setup();
  await import("@/helpers/player_menu_items");
}, 30_000);

describe("useHosts queue dj prefetch", () => {
  it("warms the ai dj caches on provider availability, so the first menu open lists the hosts", async () => {
    const { useHosts, store } = await setup();
    const { getPlayerMenuItems } = await import("@/helpers/player_menu_items");
    // Nothing is seeded: whatever the menu renders comes from the prefetch.
    expect(useHosts().hosts.value).toEqual([]);
    expect(sendCommand).not.toHaveBeenCalled();

    store.enabledPlugins = new Set(["ai_radio"]);
    await flushPromises();

    expect(sendCommand).toHaveBeenCalledWith("ai_radio/hosts/list");
    expect(sendCommand).toHaveBeenCalledWith("ai_radio/queue_dj/status");

    // First build of the menu after page load, i.e. the one that used to show
    // an empty host list with a wrongly checked "Off".
    const aiDj = getPlayerMenuItems(player, queue, { context: "queue" }).find(
      (item) => item.label === "ai_dj",
    );

    expect(aiDj?.subItems?.map((item) => item.label)).toEqual([
      "Robo DJ",
      "ai_dj_off",
    ]);
    expect(
      aiDj?.subItems?.find((item) => item.label === "ai_dj_off")?.selected,
    ).toBe(false);
  });
});

describe("useHosts provider events", () => {
  it("refetches the queue dj map on a queue_dj_updated hint, so the menu shows another client's change", async () => {
    const { useHosts } = await setupLoaded();
    expect(subscribe).toHaveBeenCalledWith(
      EventType.PROVIDER_EVENT,
      expect.any(Function),
      "ai_radio",
    );

    sendCommand.mockImplementation(async (command: string) => {
      if (command === "ai_radio/hosts/list") return [host];
      if (command === "ai_radio/queue_dj/status") return {};
      return undefined;
    });
    emit("queue_dj_updated");
    await flushPromises();

    expect(callsOf("ai_radio/queue_dj/status")).toHaveLength(1);
    expect(callsOf("ai_radio/hosts/list")).toHaveLength(0);
    expect(useHosts().queueDjStatus.value).toEqual({});
  });

  it("refetches the hosts on a hosts_updated hint", async () => {
    await setupLoaded();

    emit("hosts_updated");
    await flushPromises();

    expect(callsOf("ai_radio/hosts/list")).toHaveLength(1);
    expect(callsOf("ai_radio/queue_dj/status")).toHaveLength(0);
  });

  it("ignores hints it has no cache for", async () => {
    await setupLoaded();

    emit("sessions_updated");
    emit("stations_updated");
    emit("sections_updated");
    await flushPromises();

    expect(callsOf("ai_radio/hosts/list")).toHaveLength(0);
    expect(callsOf("ai_radio/queue_dj/status")).toHaveLength(0);
  });

  it("refetches the loaded caches once after a reconnect", async () => {
    const { api, ConnectionState } = await setupLoaded();
    api.state.value = ConnectionState.RECONNECTING;
    await flushPromises();
    sendCommand.mockClear();

    api.state.value = ConnectionState.INITIALIZED;
    await flushPromises();

    expect(callsOf("ai_radio/hosts/list")).toHaveLength(1);
    expect(callsOf("ai_radio/queue_dj/status")).toHaveLength(1);
    // nothing loaded the sections here, so a reconnect leaves them alone
    expect(callsOf("ai_radio/sections/list")).toHaveLength(0);
  });

  it("drops the subscription when the plugin goes away", async () => {
    const { store } = await setupLoaded();
    expect(listeners.length).toBeGreaterThan(0);
    store.enabledPlugins = new Set();
    await flushPromises();

    expect(listeners).toHaveLength(0);
  });
});
