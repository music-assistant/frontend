import { showUri, useShows } from "@/composables/ai-radio/useShows";
import api from "@/plugins/api";
import type { Player, PlayerQueue } from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "vue-sonner";

type SendCommand = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

const { playMedia, sendCommand } = vi.hoisted(() => ({
  playMedia: vi.fn(async () => undefined),
  sendCommand: vi.fn<SendCommand>(async () => ({})),
}));

// a successful status fetch registers its cache for provider events, which reads these
vi.mock("@/plugins/api", () => ({
  default: {
    players: {} as Record<string, Player>,
    queues: {} as Record<string, PlayerQueue>,
    state: { value: "initialized" },
    sendCommand,
    playMedia,
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock("@/plugins/store", async () => {
  const { reactive } = await import("vue");
  return { store: reactive({ enabledPlugins: new Set<string>() }) };
});

vi.mock("@/plugins/auth", () => ({
  authManager: { guestSessionKind: () => null, hasScope: () => true },
}));

vi.mock("vue-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const DJ_STATUS_COMMAND = "ai_radio/queue_dj/status";

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

  it("keeps the follow-up status refresh from raising the global error toast", async () => {
    await useShows().startShow("show-1", "kitchen");

    expect(sendCommand).toHaveBeenCalledWith(DJ_STATUS_COMMAND, undefined, {
      suppressGlobalError: true,
    });
  });

  it("tracks each starting show on its own while two starts overlap", async () => {
    let releaseFirst!: () => void;
    playMedia.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          releaseFirst = () => resolve(undefined);
        }),
    );
    const { startShow, isStarting } = useShows();

    const first = startShow("show-1", "kitchen");
    const second = startShow("show-2", "living");
    await second;

    // the second start finishing must not release the first card
    expect(isStarting("show-2")).toBe(false);
    expect(isStarting("show-1")).toBe(true);
    releaseFirst();
    await first;
    expect(isStarting("show-1")).toBe(false);
  });
});

describe("useShows refreshDjStatus", () => {
  it("applies only the newest status when refreshes finish out of order", async () => {
    let releaseOld!: (value: unknown) => void;
    sendCommand
      .mockImplementationOnce(
        () => new Promise((resolve) => (releaseOld = resolve)),
      )
      .mockResolvedValueOnce({ q2: { host_id: "amy", station_id: "show-2" } });
    const { refreshDjStatus, djStatus, loadingDjStatus } = useShows();

    const old = refreshDjStatus();
    await refreshDjStatus();
    expect(djStatus.value).toEqual({
      q2: { host_id: "amy", station_id: "show-2" },
    });
    // the older request is still pending, so the refresh is still loading
    expect(loadingDjStatus.value).toBe(true);

    releaseOld({ q1: { host_id: "amy", station_id: "show-1" } });
    // the late request hands back the newest status too, never its own stale one
    expect(await old).toEqual({
      q2: { host_id: "amy", station_id: "show-2" },
    });
    expect(djStatus.value).toEqual({
      q2: { host_id: "amy", station_id: "show-2" },
    });
    expect(loadingDjStatus.value).toBe(false);
  });
});

describe("useShows refreshDjStatus overtaken by a pending newer refresh", () => {
  it("resolves an overtaken refresh to the newest request's result", async () => {
    let releaseA!: (value: unknown) => void;
    let releaseB!: (value: unknown) => void;
    sendCommand
      .mockImplementationOnce(
        () => new Promise((resolve) => (releaseA = resolve)),
      )
      .mockImplementationOnce(
        () => new Promise((resolve) => (releaseB = resolve)),
      );
    const { refreshDjStatus, djStatus } = useShows();

    const a = refreshDjStatus();
    const b = refreshDjStatus();

    releaseA({ q1: { host_id: "amy", station_id: "show-x" } });
    await flushPromises();
    releaseB({});

    expect(await a).toEqual({});
    expect(await b).toEqual({});
    expect(djStatus.value).toEqual({});
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

    expect(sendCommand).toHaveBeenCalledWith(
      "player_queues/clear",
      { queue_id: "livingroom" },
      { suppressGlobalError: true },
    );
    expect(sendCommand).toHaveBeenCalledWith(
      "ai_radio/queue_dj/status",
      undefined,
      { suppressGlobalError: true },
    );
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
