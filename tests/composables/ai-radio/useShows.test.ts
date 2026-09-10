import { showUri, useShows } from "@/composables/ai-radio/useShows";
import api, { ConnectionState } from "@/plugins/api";
import {
  EventType,
  type Player,
  type PlayerQueue,
  type ProviderInstance,
} from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "vue-sonner";

type SendCommand = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

const { playMedia, sendCommand, subscribeMulti, unsubscribe } = vi.hoisted(
  () => ({
    playMedia: vi.fn(async () => undefined),
    sendCommand: vi.fn<SendCommand>(async () => ({})),
    subscribeMulti: vi.fn(),
    unsubscribe: vi.fn(),
  }),
);

// api.providers and api.state must be reactive here: the event tracking hangs
// off watches on the provider list and the connection state, which is exactly
// what this suite exercises.
vi.mock("@/plugins/api", async () => {
  const { reactive, ref } = await import("vue");
  return {
    default: {
      players: {} as Record<string, Player>,
      queues: {} as Record<string, PlayerQueue>,
      providers: reactive<Record<string, ProviderInstance>>({}),
      state: ref("authenticated"),
      sendCommand,
      playMedia,
      subscribe_multi: subscribeMulti,
    },
    ConnectionState: {
      AUTHENTICATED: "authenticated",
      RECONNECTING: "reconnecting",
    },
  };
});

vi.mock("@/plugins/auth", () => ({
  authManager: { guestSessionKind: () => null },
}));

vi.mock("vue-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

subscribeMulti.mockImplementation(() => unsubscribe);

const DJ_STATUS_COMMAND = "ai_radio/queue_dj/status";
const DEBOUNCE_MS = 1000;

const djStatusCalls = () =>
  sendCommand.mock.calls.filter(([command]) => command === DJ_STATUS_COMMAND)
    .length;

function setProviderAvailable(available: boolean) {
  api.providers.ai_radio = {
    domain: "ai_radio",
    available,
  } as ProviderInstance;
  return nextTick();
}

describe("useShows startShow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.players = {
      kitchen: { player_id: "kitchen", active_source: "kitchen" },
      bedroom: { player_id: "bedroom", active_source: "livingroom" },
      hall: { player_id: "hall", active_source: "spotify://audio_source/main" },
    } as unknown as typeof api.players;
    api.queues = {
      kitchen: {},
      livingroom: {},
    } as unknown as typeof api.queues;
  });

  it("plays the show on a standalone player's own queue", async () => {
    await useShows().startShow("show-1", "kitchen");

    expect(playMedia).toHaveBeenCalledWith(showUri("show-1"), undefined, {
      queue_id: "kitchen",
    });
  });

  // a synced child plays from its leader's queue; the server does not redirect
  // an explicit queue_id, so the client resolves it the way api.playMedia does
  it("routes a synced player's show to its group leader's queue", async () => {
    await useShows().startShow("show-1", "bedroom");

    expect(playMedia).toHaveBeenCalledWith(showUri("show-1"), undefined, {
      queue_id: "livingroom",
    });
  });

  it("keeps a player's own queue while an external source has it", async () => {
    await useShows().startShow("show-1", "hall");

    expect(playMedia).toHaveBeenCalledWith(showUri("show-1"), undefined, {
      queue_id: "hall",
    });
  });

  it("does not turn a failed follow-up status refresh into a failed start", async () => {
    sendCommand.mockRejectedValueOnce(new Error("Connection lost"));

    await expect(useShows().startShow("show-1", "kitchen")).resolves.toBe(
      undefined,
    );
    expect(playMedia).toHaveBeenCalledTimes(1);
  });
});

describe("useShows dj status tracking", () => {
  beforeEach(() => {
    // setImmediate stays real so the Vue scheduler and nextTick keep working.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(async () => {
    // Leave the provider unavailable so the next test starts unsubscribed.
    await setProviderAvailable(false);
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("refreshes the dj status once per burst of queue events", async () => {
    await setProviderAvailable(true);

    expect(subscribeMulti).toHaveBeenCalledWith(
      [
        EventType.QUEUE_ADDED,
        EventType.QUEUE_ITEMS_UPDATED,
        EventType.QUEUE_UPDATED,
        EventType.PLAYER_REMOVED,
      ],
      expect.any(Function),
    );
    // Subscribing reconciles once itself; let that settle before counting.
    vi.advanceTimersByTime(DEBOUNCE_MS);
    sendCommand.mockClear();
    const onQueueEvent = subscribeMulti.mock.calls[0][1] as () => void;

    onQueueEvent();
    onQueueEvent();
    onQueueEvent();
    expect(djStatusCalls()).toBe(0);

    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(djStatusCalls()).toBe(1);
  });

  it("reconciles dj status once the connection re-authenticates, debounced like other events", async () => {
    await setProviderAvailable(true);
    // Subscribing reconciles once itself; let that settle before counting.
    vi.advanceTimersByTime(DEBOUNCE_MS);
    sendCommand.mockClear();

    // Stand in for a reconnect: CONNECTED fires before re-auth completes, so
    // the reconcile must wait for the transition to AUTHENTICATED.
    api.state.value = ConnectionState.RECONNECTING;
    await nextTick();
    expect(djStatusCalls()).toBe(0);

    api.state.value = ConnectionState.AUTHENTICATED;
    await nextTick();
    expect(djStatusCalls()).toBe(0);

    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(djStatusCalls()).toBe(1);
  });

  it("stops listening once the provider goes away", async () => {
    await setProviderAvailable(true);
    expect(unsubscribe).not.toHaveBeenCalled();

    await setProviderAvailable(false);

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe("useShows stopShow", () => {
  const liveStatus = {
    livingroom: { host_id: "host-1", station_id: "show-1" },
  };

  /** Wires the dj-status re-check to report the given status just ahead of the clear. */
  function mockFreshStatus(
    status: Record<string, { host_id: string; station_id: string }>,
  ) {
    sendCommand.mockImplementation(async (command) =>
      command === "ai_radio/queue_dj/status" ? status : undefined,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    useShows().djStatus.value = { ...liveStatus };
  });

  afterEach(() => {
    useShows().djStatus.value = {};
  });

  it("clears the queue and removes the on-air entry once the command resolves", async () => {
    mockFreshStatus(liveStatus);

    await useShows().stopShow("show-1");

    expect(sendCommand).toHaveBeenCalledWith("player_queues/clear", {
      queue_id: "livingroom",
    });
    expect(useShows().onAirQueueId("show-1")).toBeUndefined();
    expect(toast.success).toHaveBeenCalled();
  });

  it("keeps the entry and skips the success toast when the clear command fails", async () => {
    sendCommand.mockImplementation(async (command) => {
      if (command === "ai_radio/queue_dj/status") return liveStatus;
      throw new Error("Connection lost");
    });

    await expect(useShows().stopShow("show-1")).rejects.toThrow(
      "Connection lost",
    );

    expect(useShows().onAirQueueId("show-1")).toBe("livingroom");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("marks the show as stopping while the fresh status and clear commands are pending", async () => {
    let resolveClear: () => void = () => undefined;
    sendCommand.mockImplementation(async (command) => {
      if (command === "ai_radio/queue_dj/status") return liveStatus;
      return new Promise((resolve) => {
        resolveClear = () => resolve(undefined);
      });
    });

    const stopPromise = useShows().stopShow("show-1");
    await nextTick();
    expect(useShows().isStopping("show-1")).toBe(true);

    // Let the fresh-status fetch resolve so the clear command is actually issued.
    await flushPromises();

    resolveClear();
    await stopPromise;
    expect(useShows().isStopping("show-1")).toBe(false);
  });

  it("applies the fresh status without clearing when the queue already moved on", async () => {
    // The cached djStatus still shows the show live, but a fresh read (as
    // taken right before the clear) shows the queue moved on to other content.
    mockFreshStatus({});

    await useShows().stopShow("show-1");

    expect(sendCommand).not.toHaveBeenCalledWith(
      "player_queues/clear",
      expect.anything(),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(useShows().djStatus.value).toEqual({});
  });
});
