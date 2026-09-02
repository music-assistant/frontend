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

  afterEach(() => {
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

  it("stops listening once the provider goes away", async () => {
    await setProviderAvailable(true);
    expect(unsubscribe).not.toHaveBeenCalled();

    await setProviderAvailable(false);

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
