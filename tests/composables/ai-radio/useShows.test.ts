import { showUri, useShows } from "@/composables/ai-radio/useShows";
import api from "@/plugins/api";
import {
  EventType,
  type Player,
  type PlayerQueue,
  type ProviderInstance,
} from "@/plugins/api/interfaces";
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

// api.providers must be reactive here: the event tracking hangs off a watch on
// the provider list, which is exactly what this suite exercises.
vi.mock("@/plugins/api", async () => {
  const { reactive } = await import("vue");
  return {
    default: {
      players: {} as Record<string, Player>,
      queues: {} as Record<string, PlayerQueue>,
      providers: reactive<Record<string, ProviderInstance>>({}),
      sendCommand,
      playMedia,
      subscribe_multi: subscribeMulti,
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
        EventType.CONNECTED,
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

  it("reconciles dj status once after a reconnect, debounced like other events", async () => {
    await setProviderAvailable(true);
    // Subscribing reconciles once itself; let that settle before counting.
    vi.advanceTimersByTime(DEBOUNCE_MS);
    sendCommand.mockClear();
    // subscribe_multi registers one callback shared by every event in DJ_STATUS_EVENTS,
    // which now includes CONNECTED; invoking it here stands in for that event firing.
    const onDjStatusEvent = subscribeMulti.mock.calls[0][1] as () => void;

    onDjStatusEvent();
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
  beforeEach(() => {
    vi.clearAllMocks();
    useShows().djStatus.value = {
      livingroom: { host_id: "host-1", station_id: "show-1" },
    };
  });

  afterEach(() => {
    useShows().djStatus.value = {};
  });

  it("clears the queue and removes the on-air entry once the command resolves", async () => {
    sendCommand.mockResolvedValueOnce(undefined);

    await useShows().stopShow("show-1");

    expect(sendCommand).toHaveBeenCalledWith("player_queues/clear", {
      queue_id: "livingroom",
    });
    expect(useShows().onAirQueueId("show-1")).toBeUndefined();
    expect(toast.success).toHaveBeenCalled();
  });

  it("keeps the entry and skips the success toast when the clear command fails", async () => {
    sendCommand.mockRejectedValueOnce(new Error("Connection lost"));

    await expect(useShows().stopShow("show-1")).rejects.toThrow(
      "Connection lost",
    );

    expect(useShows().onAirQueueId("show-1")).toBe("livingroom");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("marks the show as stopping while the clear command is pending", async () => {
    let resolveClear: () => void = () => undefined;
    sendCommand.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveClear = () => resolve(undefined);
      }),
    );

    const stopPromise = useShows().stopShow("show-1");
    await nextTick();
    expect(useShows().stoppingShowId.value).toBe("show-1");

    resolveClear();
    await stopPromise;
    expect(useShows().stoppingShowId.value).toBe("");
  });
});
