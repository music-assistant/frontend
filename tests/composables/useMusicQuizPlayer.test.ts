import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetMusicQuizInfo,
  mockGetMusicQuizState,
  mockHeartbeatMusicQuiz,
  mockJoinMusicQuiz,
  mockReadyMusicQuiz,
  mockAnswerMusicQuiz,
  mockSubscribe,
  mockStorePlayerId,
  mockGetStoredPlayerId,
  mockClearStoredPlayerId,
  mockGetMusicQuizErrorMessage,
  storedPlayerId,
  providerHandlers,
  unmountHandlers,
} = vi.hoisted(() => ({
  mockGetMusicQuizInfo: vi.fn(),
  mockGetMusicQuizState: vi.fn(),
  mockHeartbeatMusicQuiz: vi.fn(),
  mockJoinMusicQuiz: vi.fn(),
  mockReadyMusicQuiz: vi.fn(),
  mockAnswerMusicQuiz: vi.fn(),
  mockSubscribe: vi.fn(),
  mockStorePlayerId: vi.fn(),
  mockGetStoredPlayerId: vi.fn(),
  mockClearStoredPlayerId: vi.fn(),
  mockGetMusicQuizErrorMessage: vi.fn(),
  storedPlayerId: { value: null as string | null },
  providerHandlers: [] as Array<
    (event: { object_id?: string; data?: unknown }) => void
  >,
  unmountHandlers: [] as Array<() => void>,
}));

vi.mock("vue", async () => {
  const actual = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...actual,
    onMounted: (fn: () => void) => fn(),
    onBeforeUnmount: (fn: () => void) => unmountHandlers.push(fn),
  };
});

vi.mock("@/composables/useMusicQuiz", () => ({
  getMusicQuizInfo: mockGetMusicQuizInfo,
  getMusicQuizState: mockGetMusicQuizState,
  heartbeatMusicQuiz: mockHeartbeatMusicQuiz,
  joinMusicQuiz: mockJoinMusicQuiz,
  readyMusicQuiz: mockReadyMusicQuiz,
  answerMusicQuiz: mockAnswerMusicQuiz,
  isSupportedMusicQuiz: (value: { quiz_type?: string; answer_type?: string }) =>
    value.quiz_type === "guess_the_song" &&
    value.answer_type === "multiple_choice",
  isMusicQuizProviderEvent: (value: unknown) => {
    if (!value || typeof value !== "object" || !("event" in value))
      return false;
    return (
      value.event === "game_removed" ||
      (value.event === "game_updated" && "state" in value)
    );
  },
}));

vi.mock("@/plugins/api", () => ({
  default: {
    subscribe: mockSubscribe,
  },
}));

vi.mock("@/helpers/music_quiz", () => ({
  storeMusicQuizPlayerId: mockStorePlayerId,
  getStoredMusicQuizPlayerId: mockGetStoredPlayerId,
  clearStoredMusicQuizPlayerId: mockClearStoredPlayerId,
  getMusicQuizErrorMessage: mockGetMusicQuizErrorMessage,
  isNoActiveGameError: (err: unknown) => {
    const message = (
      err instanceof Error ? err.message : typeof err === "string" ? err : ""
    ).toLowerCase();
    return (
      message.includes("no active game") ||
      message.includes("no active music quiz game") ||
      (message.includes("no active") && message.includes("music quiz"))
    );
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

import { EventType } from "@/plugins/api/interfaces";
import { useMusicQuizPlayer } from "@/composables/useMusicQuizPlayer";

const QUIZ_INFO = {
  quiz_type: "guess_the_song",
  answer_type: "multiple_choice",
  name: "Quiz",
  phase: "lobby",
  player_count: 2,
  round_count: 5,
  mode: "venue",
} as const;

const PLAYER_STATE = {
  quiz_type: "guess_the_song",
  answer_type: "multiple_choice",
  phase: "lobby",
  name: "Quiz",
  round_count: 5,
  suggestion_count: 4,
  answer_duration: 30,
  mode: "venue",
  players: [
    {
      name: "Player",
      score: 0,
      ready: false,
      answered: false,
      active_from_round: 0,
    },
  ],
  current_round: null,
  you: {
    name: "Player",
    score: 0,
    ready: false,
    active_from_round: 0,
  },
} as const;

const PUBLIC_STATE = {
  quiz_type: "guess_the_song",
  answer_type: "multiple_choice",
  phase: "lobby",
  name: "Quiz",
  round_count: 5,
  suggestion_count: 4,
  answer_duration: 30,
  mode: "venue",
  players: PLAYER_STATE.players,
  current_round: null,
} as const;

async function flushPromises() {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe("useMusicQuizPlayer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    storedPlayerId.value = null;
    providerHandlers.length = 0;
    unmountHandlers.length = 0;
    mockGetMusicQuizInfo.mockReset();
    mockGetMusicQuizState.mockReset();
    mockHeartbeatMusicQuiz.mockReset();
    mockJoinMusicQuiz.mockReset();
    mockReadyMusicQuiz.mockReset();
    mockAnswerMusicQuiz.mockReset();
    mockSubscribe.mockReset();
    mockStorePlayerId.mockReset();
    mockGetStoredPlayerId.mockReset();
    mockClearStoredPlayerId.mockReset();
    mockGetMusicQuizErrorMessage.mockReset();
    mockHeartbeatMusicQuiz.mockResolvedValue(true);
    mockGetStoredPlayerId.mockImplementation(() => storedPlayerId.value);
    mockStorePlayerId.mockImplementation((playerId: string) => {
      storedPlayerId.value = playerId;
    });
    mockClearStoredPlayerId.mockImplementation(() => {
      storedPlayerId.value = null;
    });
    mockGetMusicQuizErrorMessage.mockImplementation(
      (error: unknown, fallback = "") =>
        error instanceof Error ? error.message : fallback,
    );
    mockSubscribe.mockImplementation(
      (
        _event: EventType,
        handler: (event: { object_id?: string; data?: unknown }) => void,
      ) => {
        providerHandlers.push(handler);
        return () => {};
      },
    );
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    for (const unmount of unmountHandlers.splice(0)) unmount();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("validates a stored player before fetching personalized state", async () => {
    storedPlayerId.value = "stored-player";
    mockGetMusicQuizState.mockResolvedValue(PLAYER_STATE);

    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledWith("stored-player");
    expect(mockGetMusicQuizState).toHaveBeenCalledWith("stored-player");
    expect(mockHeartbeatMusicQuiz.mock.invocationCallOrder[0]).toBeLessThan(
      mockGetMusicQuizState.mock.invocationCallOrder[0],
    );
    expect(player.playerId.value).toBe("stored-player");
    expect(player.state.value).toEqual(PLAYER_STATE);
  });

  it("returns to join info when a stored player is no longer active", async () => {
    storedPlayerId.value = "missing-player";
    mockHeartbeatMusicQuiz.mockResolvedValue(false);
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);
    const notifyError = vi.fn();

    const player = useMusicQuizPlayer({ notifyError });
    await flushPromises();

    expect(mockGetMusicQuizState).not.toHaveBeenCalled();
    expect(player.playerId.value).toBeNull();
    expect(player.state.value).toBeNull();
    expect(player.info.value).toEqual(QUIZ_INFO);
    expect(storedPlayerId.value).toBeNull();

    await vi.advanceTimersByTimeAsync(15_000);
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    await flushPromises();
    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(1);
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("heartbeats immediately and every 15 seconds", async () => {
    storedPlayerId.value = "stored-player";
    mockGetMusicQuizState.mockResolvedValue(PLAYER_STATE);

    useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(2);
  });

  it("does not overlap heartbeat requests", async () => {
    storedPlayerId.value = "stored-player";
    const pendingHeartbeat = deferred<boolean>();
    mockHeartbeatMusicQuiz
      .mockReturnValueOnce(pendingHeartbeat.promise)
      .mockResolvedValue(true);
    mockGetMusicQuizState.mockResolvedValue(PLAYER_STATE);

    useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();
    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    await flushPromises();
    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(1);

    pendingHeartbeat.resolve(true);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(2);
  });

  it("refreshes heartbeat when visibility or focus is restored", async () => {
    storedPlayerId.value = "stored-player";
    mockGetMusicQuizState.mockResolvedValue(PLAYER_STATE);

    useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new Event("focus"));
    await flushPromises();
    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(3);
  });

  it("returns to join info when a later heartbeat reports removal", async () => {
    storedPlayerId.value = "stored-player";
    mockHeartbeatMusicQuiz
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    mockGetMusicQuizState.mockResolvedValue(PLAYER_STATE);
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);
    const notifyError = vi.fn();

    const player = useMusicQuizPlayer({ notifyError });
    await flushPromises();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(player.playerId.value).toBeNull();
    expect(player.state.value).toBeNull();
    expect(player.info.value).toEqual(QUIZ_INFO);
    expect(storedPlayerId.value).toBeNull();
    expect(mockGetMusicQuizState).toHaveBeenCalledTimes(1);
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("retries transient heartbeat failures without repeated toasts", async () => {
    storedPlayerId.value = "stored-player";
    mockHeartbeatMusicQuiz
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValue(true);
    mockGetMusicQuizState.mockResolvedValue(PLAYER_STATE);
    const notifyError = vi.fn();

    const player = useMusicQuizPlayer({ notifyError });
    await flushPromises();

    expect(player.playerId.value).toBe("stored-player");
    expect(mockGetMusicQuizState).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(2);
    expect(mockGetMusicQuizState).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(3);
    expect(mockGetMusicQuizState).toHaveBeenCalledWith("stored-player");
    expect(player.state.value).toEqual(PLAYER_STATE);
    expect(storedPlayerId.value).toBe("stored-player");
  });

  it("recovers from a stale player token by returning to the join/info state", async () => {
    storedPlayerId.value = "stale-player";
    mockGetMusicQuizState.mockRejectedValue(new Error("player not found"));
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);

    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    expect(player.playerId.value).toBeNull();
    expect(player.state.value).toBeNull();
    expect(player.info.value).toEqual(QUIZ_INFO);
    expect(player.gameRemoved.value).toBe(false);
    expect(storedPlayerId.value).toBeNull();
  });

  it("recovers from a no-active-game error (string rejection) without a toast", async () => {
    storedPlayerId.value = "some-player";
    mockGetMusicQuizState.mockRejectedValue(
      "There is no active Music Quiz game",
    );
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);
    const notifyError = vi.fn();

    const player = useMusicQuizPlayer({ notifyError });
    await flushPromises();

    expect(notifyError).not.toHaveBeenCalled();
    expect(player.playerId.value).toBeNull();
    expect(player.state.value).toBeNull();
    expect(player.info.value).toEqual(QUIZ_INFO);
    expect(storedPlayerId.value).toBeNull();

    await vi.advanceTimersByTimeAsync(15_000);
    window.dispatchEvent(new Event("focus"));
    await flushPromises();
    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(1);
  });

  it("returns from game-removed state when a new game update arrives", async () => {
    mockGetMusicQuizInfo
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(QUIZ_INFO);
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    expect(player.gameRemoved.value).toBe(true);

    const handler = providerHandlers[0];
    expect(handler).toBeTypeOf("function");
    handler({
      object_id: "quiz-instance",
      data: { event: "game_updated", state: QUIZ_INFO },
    });
    await flushPromises();

    expect(player.gameRemoved.value).toBe(false);
    expect(player.info.value).toEqual(QUIZ_INFO);
  });

  it("stops heartbeat when the game is removed", async () => {
    storedPlayerId.value = "stored-player";
    mockGetMusicQuizState.mockResolvedValue(PLAYER_STATE);
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    providerHandlers[0]({
      object_id: "quiz-instance",
      data: { event: "game_removed" },
    });
    await vi.advanceTimersByTimeAsync(15_000);
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    await flushPromises();

    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(1);
    expect(player.playerId.value).toBeNull();
    expect(player.state.value).toBeNull();
    expect(player.gameRemoved.value).toBe(true);
    expect(storedPlayerId.value).toBeNull();
  });

  it("only handles provider events from the active quiz instance", async () => {
    storedPlayerId.value = "stored-player";
    mockGetMusicQuizState.mockResolvedValue(PLAYER_STATE);
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();
    expect(mockGetMusicQuizState).toHaveBeenCalledTimes(1);

    const handler = providerHandlers[0];
    expect(handler).toBeTypeOf("function");

    handler({
      object_id: "quiz-instance",
      data: { event: "game_updated", state: PUBLIC_STATE },
    });
    await flushPromises();
    expect(mockGetMusicQuizState).toHaveBeenCalledTimes(2);

    handler({
      object_id: "other-instance",
      data: {
        event: "game_updated",
        state: { ...PUBLIC_STATE, players: [] },
      },
    });
    await flushPromises();
    expect(mockGetMusicQuizState).toHaveBeenCalledTimes(2);
    expect(player.playerId.value).toBe("stored-player");
  });

  it("uses public updates to detect a removed player", async () => {
    storedPlayerId.value = "stored-player";
    mockGetMusicQuizState.mockResolvedValue(PLAYER_STATE);
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);
    const notifyError = vi.fn();
    const player = useMusicQuizPlayer({ notifyError });
    await flushPromises();

    providerHandlers[0]({
      object_id: "quiz-instance",
      data: {
        event: "game_updated",
        state: { ...PUBLIC_STATE, players: [] },
      },
    });
    await flushPromises();

    expect(mockGetMusicQuizState).toHaveBeenCalledTimes(1);
    expect(mockGetMusicQuizInfo).toHaveBeenCalledTimes(1);
    expect(player.playerId.value).toBeNull();
    expect(player.state.value).toBeNull();
    expect(player.info.value).toEqual(QUIZ_INFO);
    expect(storedPlayerId.value).toBeNull();
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("keeps game identity across info, join, and provider refresh", async () => {
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);
    mockJoinMusicQuiz.mockResolvedValue({
      player_id: "player-id",
      state: PLAYER_STATE,
    });
    mockGetMusicQuizState.mockResolvedValue({
      ...PLAYER_STATE,
      phase: "answering",
    });

    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();
    expect(player.info.value?.quiz_type).toBe("guess_the_song");
    expect(player.info.value?.answer_type).toBe("multiple_choice");

    await player.join("Player");
    expect(player.state.value?.quiz_type).toBe("guess_the_song");
    expect(player.state.value?.answer_type).toBe("multiple_choice");

    providerHandlers[0]({
      object_id: "quiz-instance",
      data: { event: "game_updated", state: PUBLIC_STATE },
    });
    await flushPromises();

    expect(mockGetMusicQuizState).toHaveBeenCalledWith("player-id");
    expect(player.state.value?.quiz_type).toBe("guess_the_song");
    expect(player.state.value?.answer_type).toBe("multiple_choice");
    expect(player.state.value?.phase).toBe("answering");
  });

  it("stops heartbeat when leaving", async () => {
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);
    mockJoinMusicQuiz.mockResolvedValue({
      player_id: "player-id",
      state: PLAYER_STATE,
    });
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();
    await player.join("Player");
    await flushPromises();

    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(1);
    await player.leave();
    await vi.advanceTimersByTimeAsync(15_000);
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    await flushPromises();

    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(1);
    expect(player.playerId.value).toBeNull();
    expect(storedPlayerId.value).toBeNull();
  });

  it("stops heartbeat when unmounted", async () => {
    storedPlayerId.value = "stored-player";
    mockGetMusicQuizState.mockResolvedValue(PLAYER_STATE);
    useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(1);
    unmountHandlers[0]();
    await vi.advanceTimersByTimeAsync(15_000);
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    await flushPromises();

    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(1);
  });

  it("replaces heartbeat ownership without overlapping requests", async () => {
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);
    mockJoinMusicQuiz
      .mockResolvedValueOnce({
        player_id: "first-player",
        state: PLAYER_STATE,
      })
      .mockResolvedValueOnce({
        player_id: "second-player",
        state: PLAYER_STATE,
      });
    const firstHeartbeat = deferred<boolean>();
    mockHeartbeatMusicQuiz
      .mockReturnValueOnce(firstHeartbeat.promise)
      .mockResolvedValue(true);
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    await player.join("Player");
    await flushPromises();
    await player.join("Player");
    await flushPromises();
    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(1);

    firstHeartbeat.resolve(false);
    await flushPromises();
    expect(mockHeartbeatMusicQuiz).toHaveBeenNthCalledWith(2, "second-player");

    await vi.advanceTimersByTimeAsync(15_000);
    expect(mockHeartbeatMusicQuiz).toHaveBeenNthCalledWith(3, "second-player");
    expect(player.playerId.value).toBe("second-player");
    expect(storedPlayerId.value).toBe("second-player");
  });

  it("preserves game identity when reconnecting with a stored player", async () => {
    storedPlayerId.value = "stored-player";
    mockGetMusicQuizState.mockResolvedValue(PLAYER_STATE);

    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    expect(player.playerId.value).toBe("stored-player");
    expect(player.state.value?.quiz_type).toBe("guess_the_song");
    expect(player.state.value?.answer_type).toBe("multiple_choice");
  });

  it("submits a discriminated answer through the legacy command", async () => {
    storedPlayerId.value = "stored-player";
    mockGetMusicQuizState.mockResolvedValue(PLAYER_STATE);
    const answeredState = {
      ...PLAYER_STATE,
      phase: "answering",
      you: {
        ...PLAYER_STATE.you,
        answer: {
          suggestion_id: "suggestion-1",
          answered_at: 10,
        },
      },
    } as const;
    mockAnswerMusicQuiz.mockResolvedValue(answeredState);

    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();
    await player.submitAnswer({
      answer_type: "multiple_choice",
      suggestion_id: "suggestion-1",
    });

    expect(mockAnswerMusicQuiz).toHaveBeenCalledWith(
      "stored-player",
      "suggestion-1",
    );
    expect(player.state.value).toEqual(answeredState);
  });

  it("does not expose guess-the-song fields for an unknown game type", async () => {
    mockGetMusicQuizInfo.mockResolvedValue({
      quiz_type: "future_game",
      answer_type: "multiple_choice",
      phase: "lobby",
      name: "Future Quiz",
    });

    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    expect(player.info.value?.quiz_type).toBe("future_game");
    expect(player.currentRound.value).toBeNull();
    expect(player.players.value).toEqual([]);
    expect(player.yourName.value).toBe("");
  });

  it("does not expose gameplay for an unknown answer type", async () => {
    mockGetMusicQuizInfo.mockResolvedValue({
      quiz_type: "guess_the_song",
      answer_type: "timeline",
      phase: "lobby",
      name: "Future Quiz",
    });

    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    expect(player.info.value?.answer_type).toBe("timeline");
    expect(player.currentRound.value).toBeNull();
    expect(player.players.value).toEqual([]);
  });
});
