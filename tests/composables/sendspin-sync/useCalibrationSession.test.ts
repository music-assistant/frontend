import { useCalibrationSession } from "@/composables/sendspin-sync/useCalibrationSession";
import { ApiCommandError } from "@/plugins/api/errors";
import type { CalibrationSessionState } from "@/plugins/api/interfaces";
import { effectScope } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendCommand } = vi.hoisted(() => ({ sendCommand: vi.fn() }));

vi.mock("@/plugins/api", () => ({ default: { sendCommand } }));

const PLAYERS = [
  {
    player_id: "living",
    name: "Living room",
    busy: false,
    adjustable: true,
    silent: false,
  },
  {
    player_id: "kitchen",
    name: "Kitchen",
    busy: true,
    adjustable: true,
    silent: false,
  },
];

/** A command the server answered with a refusal, in its own words. */
function refusal(message: string): ApiCommandError {
  return new ApiCommandError(message, 1, message);
}

function sessionState(
  overrides: Partial<CalibrationSessionState> = {},
): CalibrationSessionState {
  return {
    anchor_player_id: "living",
    queue_id: "queue-1",
    player_ids: ["living", "kitchen"],
    soloed_player_id: null,
    streaming: true,
    ...overrides,
  };
}

let scopes: ReturnType<typeof effectScope>[] = [];

function withScope<T>(factory: () => T): T {
  const scope = effectScope();
  scopes.push(scope);
  return scope.run(factory)!;
}

/** The arguments of every call to one command, oldest first. */
function callsTo(command: string): unknown[][] {
  return sendCommand.mock.calls
    .filter((call) => call[0] === command)
    .map((call) => call.slice(1));
}

beforeEach(() => {
  scopes = [];
  sendCommand.mockReset();
  // The real command always hands back a promise, including for the teardown
  // `stop_session` a test has not queued a result for.
  sendCommand.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  for (const scope of scopes) scope.stop();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useCalibrationSession", () => {
  it("lists the speakers a session can run against", async () => {
    sendCommand.mockResolvedValue(PLAYERS);
    const session = withScope(() => useCalibrationSession());

    expect(await session.loadPlayers()).toBe(true);
    expect(session.players.value).toEqual(PLAYERS);
    expect(callsTo("sendspin_sync/eligible_players")).toHaveLength(1);
  });

  it("starts a session over the speakers in the order they were picked", async () => {
    sendCommand.mockResolvedValue(sessionState());
    const session = withScope(() => useCalibrationSession());

    expect(await session.start(["living", "kitchen"], true)).toBe(true);
    expect(callsTo("sendspin_sync/start_session")[0][0]).toEqual({
      player_ids: ["living", "kitchen"],
      force: true,
    });
    expect(session.state.value).toEqual(sessionState());
  });

  it("solos one speaker without disturbing the stream", async () => {
    sendCommand.mockResolvedValue(
      sessionState({ soloed_player_id: "kitchen" }),
    );
    const session = withScope(() => useCalibrationSession());

    expect(await session.solo("kitchen")).toBe(true);
    expect(callsTo("sendspin_sync/solo_player")[0][0]).toEqual({
      player_id: "kitchen",
    });
    expect(session.state.value?.soloed_player_id).toBe("kitchen");
  });

  it("passes the measured offsets through untouched", async () => {
    // The offsets are relative and the server does the normalising: pre-shifting
    // or flipping them here would double the correction it then applies.
    const offsets = { living: 0, kitchen: -7.25 };
    const result = {
      applied: { living: 8 },
      previous: { living: 250 },
      manual: { kitchen: 0 },
    };
    sendCommand.mockResolvedValue(result);
    const session = withScope(() => useCalibrationSession());

    expect(await session.apply(offsets)).toEqual(result);
    expect(callsTo("sendspin_sync/apply_measurements")[0][0]).toEqual({
      offsets_ms: offsets,
    });
  });

  it("reports an expired session rather than failing one button", async () => {
    const session = withScope(() => useCalibrationSession());
    sendCommand.mockResolvedValueOnce(sessionState());
    await session.start(["living", "kitchen"]);

    // The phone was out of reach too long: the server gave the speakers back, so
    // soloing is refused and asking for the session confirms there is none.
    sendCommand.mockRejectedValueOnce(refusal("No calibration session"));
    sendCommand.mockResolvedValueOnce(null);

    expect(await session.solo("kitchen")).toBe(false);
    expect(session.lost.value).toBe("expired");
    expect(session.state.value).toBeNull();
    expect(session.owned.value).toBe(false);
  });

  it("shows the server's own reason for a refusal, and keeps the session", async () => {
    const session = withScope(() => useCalibrationSession());
    sendCommand.mockResolvedValueOnce(sessionState());
    await session.start(["living", "kitchen"]);

    // The command was refused but the session is still there, so this is not an
    // expiry: it is something the user can put right and try again.
    sendCommand.mockRejectedValueOnce(refusal("Kitchen is not available."));
    sendCommand.mockResolvedValueOnce(sessionState());

    expect(await session.solo("kitchen")).toBe(false);
    expect(session.lost.value).toBeNull();
    expect(session.problem.value).toEqual({
      kind: "refused",
      message: "Kitchen is not available.",
    });
    expect(session.state.value).not.toBeNull();
  });

  it("does not call a refused start an expiry", async () => {
    const session = withScope(() => useCalibrationSession());
    // A muted speaker is the likeliest first refusal there is. No session ever
    // existed, so "it timed out" would be the wrong thing to say twice over.
    sendCommand.mockRejectedValueOnce(
      refusal("Kitchen is muted or turned all the way down."),
    );

    expect(await session.start(["living", "kitchen"])).toBe(false);
    expect(session.lost.value).toBeNull();
    expect(session.problem.value).toEqual({
      kind: "refused",
      message: "Kitchen is muted or turned all the way down.",
    });
    // Nothing was asked about a session this page never had.
    expect(callsTo("sendspin_sync/session")).toHaveLength(0);
  });

  it("puts a problem away once a command goes through", async () => {
    const session = withScope(() => useCalibrationSession());
    sendCommand.mockRejectedValueOnce(refusal("Kitchen is muted."));
    await session.start(["living", "kitchen"]);
    expect(session.problem.value).not.toBeNull();

    sendCommand.mockResolvedValueOnce(sessionState());
    await session.start(["living", "kitchen"]);

    expect(session.problem.value).toBeNull();
  });

  it("tries a solo that never reached the server once more", async () => {
    vi.useFakeTimers();
    const session = withScope(() => useCalibrationSession());
    sendCommand.mockResolvedValueOnce(sessionState());
    await session.start(["living", "kitchen"]);

    // A far room at the edge of the Wi-Fi. Soloing the speaker that is already
    // soloed changes nothing, so sending it twice is safe.
    sendCommand.mockRejectedValueOnce(new Error("Connection lost"));
    sendCommand.mockResolvedValueOnce(
      sessionState({ soloed_player_id: "kitchen" }),
    );
    const pending = session.solo("kitchen");
    await vi.advanceTimersByTimeAsync(1_500);

    expect(await pending).toBe(true);
    expect(callsTo("sendspin_sync/solo_player")).toHaveLength(2);
    expect(session.problem.value).toBeNull();
  });

  it("says the server was out of reach, and keeps the run", async () => {
    vi.useFakeTimers();
    const session = withScope(() => useCalibrationSession());
    sendCommand.mockResolvedValueOnce(sessionState());
    await session.start(["living", "kitchen"]);

    sendCommand.mockRejectedValueOnce(new Error("Connection lost"));
    sendCommand.mockRejectedValueOnce(new Error("Connection lost"));
    const pending = session.solo("kitchen");
    await vi.advanceTimersByTimeAsync(1_500);

    // Nothing measured so far is any less true, so this costs another tap and
    // no more than that.
    expect(await pending).toBe(false);
    expect(session.problem.value).toEqual({ kind: "unreachable" });
    expect(session.lost.value).toBeNull();
    expect(session.state.value).not.toBeNull();
  });

  it("never sends an apply twice on its own", async () => {
    vi.useFakeTimers();
    const session = withScope(() => useCalibrationSession());
    sendCommand.mockRejectedValueOnce(new Error("Connection lost"));

    const pending = session.apply({ living: 0, kitchen: 12 });
    await vi.advanceTimersByTimeAsync(5_000);

    // The server folds in the delays the speakers carry, so a second apply of
    // the same readings would correct the correction.
    expect(await pending).toBeNull();
    expect(callsTo("sendspin_sync/apply_measurements")).toHaveLength(1);
    expect(session.problem.value).toEqual({ kind: "unreachable" });
  });

  it("tells the server it is still there, well inside the timeout", async () => {
    vi.useFakeTimers();
    const session = withScope(() => useCalibrationSession());
    sendCommand.mockResolvedValue(
      sessionState({ soloed_player_id: "kitchen" }),
    );
    await session.start(["living", "kitchen"]);

    await vi.advanceTimersByTimeAsync(90_000);

    expect(callsTo("sendspin_sync/keep_alive")).toHaveLength(3);
    // A keep-alive changes nothing: no speaker is touched to send one.
    expect(callsTo("sendspin_sync/solo_player")).toHaveLength(0);
  });

  it("says nothing about a keep-alive that did not get through", async () => {
    vi.useFakeTimers();
    const session = withScope(() => useCalibrationSession());
    sendCommand.mockResolvedValueOnce(sessionState());
    await session.start(["living", "kitchen"]);

    sendCommand.mockRejectedValueOnce(new Error("Connection lost"));
    await vi.advanceTimersByTimeAsync(30_000);

    // One that was missed says nothing about the run, and the next one is half
    // a minute away.
    expect(session.problem.value).toBeNull();
    expect(session.lost.value).toBeNull();
    expect(session.state.value).not.toBeNull();
  });

  it("learns from a keep-alive that the session has gone", async () => {
    vi.useFakeTimers();
    const session = withScope(() => useCalibrationSession());
    sendCommand.mockResolvedValueOnce(sessionState());
    await session.start(["living", "kitchen"]);

    sendCommand.mockRejectedValueOnce(refusal("No calibration session"));
    sendCommand.mockResolvedValueOnce(null);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(session.lost.value).toBe("expired");

    // And stops sending them: there is nothing left to keep alive.
    sendCommand.mockClear();
    await vi.advanceTimersByTimeAsync(180_000);
    expect(sendCommand).not.toHaveBeenCalled();
  });

  it("leaves a session it only found running to whoever started it", async () => {
    const session = withScope(() => useCalibrationSession());
    sendCommand.mockResolvedValueOnce(sessionState());
    await session.refresh();
    expect(session.state.value).not.toBeNull();
    expect(session.owned.value).toBe(false);

    // Closing this page must not end a walk in progress on another device.
    await session.stop();

    expect(callsTo("sendspin_sync/stop_session")).toHaveLength(0);
    expect(session.state.value).not.toBeNull();
  });

  it("ends a session it found running when asked to", async () => {
    const session = withScope(() => useCalibrationSession());
    sendCommand.mockResolvedValueOnce(sessionState());
    await session.refresh();

    await session.stop(true);

    expect(callsTo("sendspin_sync/stop_session")).toHaveLength(1);
    expect(session.state.value).toBeNull();
  });

  it("does not call a refusal an expiry on a page that owns no session", async () => {
    const session = withScope(() => useCalibrationSession());
    // Somebody else's session is running, so a start from here is refused.
    sendCommand.mockRejectedValueOnce(
      refusal("A calibration session is already running."),
    );

    expect(await session.start(["living", "kitchen"])).toBe(false);
    expect(session.lost.value).toBeNull();
    expect(session.problem.value?.kind).toBe("refused");
  });

  it("gives the speakers back, and does not report a stop that failed", async () => {
    const session = withScope(() => useCalibrationSession());
    sendCommand.mockResolvedValueOnce(sessionState());
    await session.start(["living", "kitchen"]);

    sendCommand.mockRejectedValueOnce(new Error("already gone"));
    await session.stop();

    expect(callsTo("sendspin_sync/stop_session")).toHaveLength(1);
    expect(session.state.value).toBeNull();
    // A session the server has already dropped is the outcome wanted here.
    expect(session.lost.value).toBeNull();
  });

  it("does not stop a session it never started", async () => {
    const session = withScope(() => useCalibrationSession());

    await session.stop();

    expect(callsTo("sendspin_sync/stop_session")).toHaveLength(0);
  });

  it("ends a session whose start was still pending when the page was left", async () => {
    vi.useFakeTimers();
    let answerStart: (state: CalibrationSessionState) => void = () => undefined;
    sendCommand.mockImplementation((command: string) =>
      command === "sendspin_sync/start_session"
        ? new Promise((resolve) => (answerStart = resolve))
        : Promise.resolve(undefined),
    );
    const session = withScope(() => useCalibrationSession());

    const starting = session.start(["living", "kitchen"]);
    // The page goes away: there is no session to end yet, so this ends nothing.
    await session.stop();
    expect(callsTo("sendspin_sync/stop_session")).toHaveLength(0);

    answerStart(sessionState());

    // The server took the speakers after all, and nobody is left to give them
    // back unless the start does it.
    expect(await starting).toBe(false);
    expect(callsTo("sendspin_sync/stop_session")).toHaveLength(1);
    expect(session.state.value).toBeNull();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(callsTo("sendspin_sync/keep_alive")).toHaveLength(0);
  });

  it("stops the session when its scope goes away", async () => {
    const scope = effectScope();
    const session = scope.run(() => useCalibrationSession())!;
    sendCommand.mockResolvedValue(sessionState());
    await session.start(["living", "kitchen"]);

    sendCommand.mockClear();
    scope.stop();
    await Promise.resolve();

    expect(callsTo("sendspin_sync/stop_session")).toHaveLength(1);
  });
});
