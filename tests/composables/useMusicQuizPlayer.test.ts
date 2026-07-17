import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetMusicQuizInfo,
  mockGetMusicQuizState,
  mockHeartbeatMusicQuiz,
  mockJoinMusicQuiz,
  mockReadyMusicQuiz,
  mockAnswerMusicQuiz,
  mockSubmitMusicQuizAnswer,
  mockSubscribe,
  mockStorePlayerId,
  mockStorePlayerName,
  mockGetStoredPlayerId,
  mockGetStoredPlayerName,
  mockClearStoredPlayerId,
  mockGetMusicQuizErrorMessage,
  mockMarkJoinedGameEnded,
  mockWaitForApiInitialization,
  storedPlayerId,
  storedPlayerName,
  providerHandlers,
  unmountHandlers,
  participantContext,
} = vi.hoisted(() => ({
  mockGetMusicQuizInfo: vi.fn(),
  mockGetMusicQuizState: vi.fn(),
  mockHeartbeatMusicQuiz: vi.fn(),
  mockJoinMusicQuiz: vi.fn(),
  mockReadyMusicQuiz: vi.fn(),
  mockAnswerMusicQuiz: vi.fn(),
  mockSubmitMusicQuizAnswer: vi.fn(),
  mockSubscribe: vi.fn(),
  mockStorePlayerId: vi.fn(),
  mockStorePlayerName: vi.fn(),
  mockGetStoredPlayerId: vi.fn(),
  mockGetStoredPlayerName: vi.fn(),
  mockClearStoredPlayerId: vi.fn(),
  mockGetMusicQuizErrorMessage: vi.fn(),
  mockMarkJoinedGameEnded: vi.fn(),
  mockWaitForApiInitialization: vi.fn(),
  storedPlayerId: { value: null as string | null },
  storedPlayerName: { value: "" },
  providerHandlers: [] as Array<
    (event: { object_id?: string; data?: unknown }) => void
  >,
  unmountHandlers: [] as Array<() => void>,
  participantContext: {
    connectionIdentity: "local:http://music-assistant:8095",
    participantIdentity: "participant-token",
  } as const,
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
  submitMusicQuizAnswer: mockSubmitMusicQuizAnswer,
  isSupportedMusicQuiz: (value: { quiz_type?: string; answer_type?: string }) =>
    (value.quiz_type === "guess_the_song" &&
      value.answer_type === "multiple_choice") ||
    (value.quiz_type === "music_timeline" && value.answer_type === "timeline"),
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
    baseUrl: "http://music-assistant:8095",
    isRemoteConnection: { value: false },
    subscribe: mockSubscribe,
  },
}));

vi.mock("@/helpers/connection_identity", () => ({
  createLocalConnectionIdentity: () => participantContext.connectionIdentity,
  createRemoteConnectionIdentity: () => undefined,
}));

vi.mock("@/plugins/auth", () => ({
  authManager: {
    getClaim: () => participantContext.participantIdentity,
  },
}));

vi.mock("@/plugins/store", () => ({
  store: {
    currentUser: undefined,
  },
}));

vi.mock("@/plugins/remote", () => ({
  remoteConnectionManager: {
    currentRemoteId: { value: null },
  },
}));

vi.mock("@/plugins/api/helpers", () => ({
  waitForApiInitialization: mockWaitForApiInitialization,
}));

vi.mock("@/helpers/music_quiz", () => ({
  storeMusicQuizPlayerId: mockStorePlayerId,
  storeMusicQuizPlayerName: mockStorePlayerName,
  getStoredMusicQuizPlayerId: mockGetStoredPlayerId,
  getStoredMusicQuizPlayerName: mockGetStoredPlayerName,
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

vi.mock("@/helpers/music_quiz_guest_state", () => ({
  markMusicQuizJoinedGameEnded: mockMarkJoinedGameEnded,
}));

import { EventType } from "@/plugins/api/interfaces";
import { useMusicQuizPlayer } from "@/composables/useMusicQuizPlayer";

const originalVisibilityStateDescriptor = Object.getOwnPropertyDescriptor(
  document,
  "visibilityState",
);

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

const TIMELINE_ANCHOR = {
  entry_id: "anchor",
  release_year: 1990,
  title: "Anchor",
  artist: "Artist",
  track_uri: "library://track/anchor",
  image_url: null,
  is_anchor: true,
} as const;
const TIMELINE_CURRENT = {
  ...TIMELINE_ANCHOR,
  entry_id: "current",
  release_year: 2000,
  title: "Current",
  track_uri: "library://track/current",
  is_anchor: false,
} as const;
const TIMELINE_PUBLIC_PLAYER = {
  name: "Player",
  score: 0,
  ready: false,
  answered: false,
  placed: false,
  artist_bonus_answered: false,
  title_bonus_answered: false,
} as const;
const TIMELINE_ANSWERING_STATE = {
  quiz_type: "music_timeline",
  answer_type: "timeline",
  phase: "answering",
  name: "Music Timeline",
  round_count: 2,
  answer_duration: 30,
  artist_bonus_mode: "free_text",
  title_bonus_mode: "off",
  mode: "venue",
  players: [TIMELINE_PUBLIC_PLAYER],
  current_round: {
    round_index: 0,
    started_at: 1,
    deadline: 31,
    auto_advance_at: null,
    question: null,
    timeline: [TIMELINE_ANCHOR],
    bonus_definitions: [
      {
        bonus_type: "artist",
        mode: "free_text",
      },
    ],
  },
  you: {
    name: "Player",
    score: 0,
    ready: false,
    active_from_round: 0,
  },
} as const;
const TIMELINE_PLACED_STATE = {
  ...TIMELINE_ANSWERING_STATE,
  players: [
    {
      ...TIMELINE_PUBLIC_PLAYER,
      placed: true,
    },
  ],
  you: {
    ...TIMELINE_ANSWERING_STATE.you,
    answer: {
      previous_entry_id: "anchor",
      next_entry_id: null,
      answered_at: 10,
      bonuses: [],
      finished: false,
    },
  },
} as const;
const TIMELINE_REVEAL_STATE = {
  ...TIMELINE_PLACED_STATE,
  phase: "reveal",
  players: [
    {
      ...TIMELINE_PUBLIC_PLAYER,
      score: 1000,
      placed: true,
      last_answer: {
        placement: {
          previous_entry_id: "anchor",
          next_entry_id: null,
          correct: true,
          points: 1000,
        },
      },
    },
  ],
  current_round: {
    ...TIMELINE_ANSWERING_STATE.current_round,
    timeline: [TIMELINE_ANCHOR, TIMELINE_CURRENT],
    revealed_entry: TIMELINE_CURRENT,
    answer_label: "Artist - Current",
    track_uri: "library://track/current",
    image_url: null,
    duration: 180,
    ended_at: 20,
  },
  you: {
    ...TIMELINE_PLACED_STATE.you,
    score: 1000,
    answer: {
      ...TIMELINE_PLACED_STATE.you.answer,
      correct: true,
      points: 1000,
      bonus_results: [],
    },
  },
} as const;
const TIMELINE_NEXT_STATE = {
  ...TIMELINE_ANSWERING_STATE,
  players: [
    {
      ...TIMELINE_PUBLIC_PLAYER,
      score: 1000,
    },
  ],
  current_round: {
    ...TIMELINE_ANSWERING_STATE.current_round,
    round_index: 1,
    started_at: 30,
    deadline: 60,
    timeline: [TIMELINE_ANCHOR, TIMELINE_CURRENT],
  },
  you: {
    ...TIMELINE_ANSWERING_STATE.you,
    score: 1000,
  },
} as const;

async function flushPromises() {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe("useMusicQuizPlayer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    storedPlayerId.value = null;
    storedPlayerName.value = "";
    providerHandlers.length = 0;
    unmountHandlers.length = 0;
    mockGetMusicQuizInfo.mockReset();
    mockGetMusicQuizState.mockReset();
    mockHeartbeatMusicQuiz.mockReset();
    mockJoinMusicQuiz.mockReset();
    mockReadyMusicQuiz.mockReset();
    mockAnswerMusicQuiz.mockReset();
    mockSubmitMusicQuizAnswer.mockReset();
    mockSubscribe.mockReset();
    mockStorePlayerId.mockReset();
    mockStorePlayerName.mockReset();
    mockGetStoredPlayerId.mockReset();
    mockGetStoredPlayerName.mockReset();
    mockClearStoredPlayerId.mockReset();
    mockGetMusicQuizErrorMessage.mockReset();
    mockMarkJoinedGameEnded.mockReset();
    mockWaitForApiInitialization.mockReset();
    mockWaitForApiInitialization.mockResolvedValue(undefined);
    mockHeartbeatMusicQuiz.mockResolvedValue(true);
    mockGetStoredPlayerId.mockImplementation(() => storedPlayerId.value);
    mockGetStoredPlayerName.mockImplementation(() => storedPlayerName.value);
    mockStorePlayerId.mockImplementation((playerId: string) => {
      storedPlayerId.value = playerId;
    });
    mockClearStoredPlayerId.mockImplementation(() => {
      storedPlayerId.value = null;
    });
    mockStorePlayerName.mockImplementation((name: string) => {
      storedPlayerName.value = name;
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
    if (originalVisibilityStateDescriptor) {
      Object.defineProperty(
        document,
        "visibilityState",
        originalVisibilityStateDescriptor,
      );
    } else {
      Reflect.deleteProperty(document, "visibilityState");
    }
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("defers the initial fetch until the API connection is initialized", async () => {
    // On a hard page refresh the composable can mount before the API has
    // fetched server state (providers); probing too early would resolve to
    // a wrong "no quiz" answer.
    const initialization = deferred<void>();
    mockWaitForApiInitialization.mockReturnValue(initialization.promise);
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);

    useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    expect(mockGetMusicQuizInfo).not.toHaveBeenCalled();

    initialization.resolve(undefined);
    await flushPromises();

    expect(mockGetMusicQuizInfo).toHaveBeenCalled();
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
    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(3);
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
      .mockResolvedValueOnce(true)
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

    await vi.advanceTimersByTimeAsync(15_000);
    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(4);
    expect(notifyError).toHaveBeenCalledTimes(2);
    expect(player.playerId.value).toBe("stored-player");
  });

  it("contains heartbeat callback failures", async () => {
    storedPlayerId.value = "stored-player";
    mockGetMusicQuizState.mockRejectedValue(new Error("State failed"));
    const notifyError = vi.fn(() => {
      throw new Error("Toast failed");
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const player = useMusicQuizPlayer({ notifyError });
    await flushPromises();

    expect(player.playerId.value).toBe("stored-player");
    await vi.waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "[Music Quiz] Heartbeat error handler failed",
        expect.objectContaining({ message: "Toast failed" }),
      ),
    );
    consoleError.mockRestore();
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

  it("keeps the initial no-game state distinct from a removed joined game", async () => {
    mockGetMusicQuizInfo
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(QUIZ_INFO);
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    expect(player.gameRemoved.value).toBe(false);

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

  it("ignores pending info after the game is removed", async () => {
    storedPlayerId.value = "stored-player";
    mockHeartbeatMusicQuiz.mockResolvedValue(false);
    const pendingInfo = deferred<typeof QUIZ_INFO>();
    mockGetMusicQuizInfo.mockReturnValueOnce(pendingInfo.promise);
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    providerHandlers[0]({
      object_id: "quiz-instance",
      data: { event: "game_removed" },
    });
    pendingInfo.resolve(QUIZ_INFO);
    await flushPromises();

    expect(player.gameRemoved.value).toBe(true);
    expect(mockMarkJoinedGameEnded).toHaveBeenCalledOnce();
    expect(player.info.value).toBeNull();
    expect(player.playerId.value).toBeNull();
    expect(player.state.value).toBeNull();
    expect(player.loading.value).toBe(false);
  });

  it("ignores pending info after resetting to join", async () => {
    const staleInfo = deferred<typeof QUIZ_INFO>();
    const refreshedInfo = deferred<typeof QUIZ_INFO>();
    mockGetMusicQuizInfo
      .mockReturnValueOnce(staleInfo.promise)
      .mockReturnValueOnce(refreshedInfo.promise);
    mockJoinMusicQuiz.mockResolvedValue({
      player_id: "player-id",
      state: PLAYER_STATE,
    });
    const notifyError = vi.fn();
    const player = useMusicQuizPlayer({ notifyError });
    await flushPromises();
    await player.join("Player");
    await flushPromises();

    providerHandlers[0]({
      object_id: "quiz-instance",
      data: {
        event: "game_updated",
        state: { ...PUBLIC_STATE, players: [] },
      },
    });
    await flushPromises();

    staleInfo.resolve(QUIZ_INFO);
    await flushPromises();
    expect(player.info.value).toBeNull();
    expect(player.loading.value).toBe(true);

    refreshedInfo.resolve(QUIZ_INFO);
    await flushPromises();
    expect(player.info.value).toEqual(QUIZ_INFO);
    expect(player.playerId.value).toBeNull();
    expect(player.state.value).toBeNull();
    expect(player.loading.value).toBe(false);
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("ignores pending info errors after leaving", async () => {
    const pendingInfo = deferred<typeof QUIZ_INFO>();
    mockGetMusicQuizInfo.mockReturnValueOnce(pendingInfo.promise);
    const notifyError = vi.fn();
    const player = useMusicQuizPlayer({ notifyError });
    await flushPromises();

    await player.leave();
    pendingInfo.reject(new Error("Late info failure"));
    await flushPromises();

    expect(player.info.value).toBeNull();
    expect(player.playerId.value).toBeNull();
    expect(player.state.value).toBeNull();
    expect(player.loading.value).toBe(false);
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("stops heartbeat when the game is removed", async () => {
    storedPlayerId.value = "stored-player";
    storedPlayerName.value = "Player";
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
    expect(player.rememberedName.value).toBe("Player");
    expect(storedPlayerName.value).toBe("Player");
  });

  it("does not carry joined status into a later unjoined game", async () => {
    storedPlayerId.value = "stored-player";
    mockGetMusicQuizState.mockResolvedValue(PLAYER_STATE);
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    providerHandlers[0]({
      object_id: "quiz-instance",
      data: { event: "game_removed" },
    });
    expect(player.gameRemoved.value).toBe(true);
    expect(mockMarkJoinedGameEnded).toHaveBeenCalledOnce();

    providerHandlers[0]({
      object_id: "quiz-instance",
      data: { event: "game_updated", state: PUBLIC_STATE },
    });
    await flushPromises();
    expect(player.gameRemoved.value).toBe(false);

    providerHandlers[0]({
      object_id: "quiz-instance",
      data: { event: "game_removed" },
    });

    expect(player.gameRemoved.value).toBe(false);
    expect(mockMarkJoinedGameEnded).toHaveBeenCalledOnce();
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

  it("refreshes safely when a public update has no player list", async () => {
    storedPlayerId.value = "stored-player";
    mockGetMusicQuizState.mockResolvedValue(PLAYER_STATE);
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    expect(() =>
      providerHandlers[0]({
        object_id: "quiz-instance",
        data: { event: "game_updated", state: QUIZ_INFO },
      }),
    ).not.toThrow();
    await flushPromises();

    expect(mockGetMusicQuizState).toHaveBeenCalledTimes(2);
    expect(player.playerId.value).toBe("stored-player");
  });

  it("keeps loading until removal recovery finishes", async () => {
    storedPlayerId.value = "stored-player";
    mockGetMusicQuizState.mockResolvedValueOnce(PLAYER_STATE);
    const staleState = deferred<typeof PLAYER_STATE>();
    const refreshedInfo = deferred<typeof QUIZ_INFO>();
    mockGetMusicQuizState.mockReturnValueOnce(staleState.promise);
    mockGetMusicQuizInfo.mockReturnValueOnce(refreshedInfo.promise);
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    providerHandlers[0]({
      object_id: "quiz-instance",
      data: { event: "game_updated", state: PUBLIC_STATE },
    });
    await flushPromises();
    expect(player.loading.value).toBe(true);

    providerHandlers[0]({
      object_id: "quiz-instance",
      data: {
        event: "game_updated",
        state: { ...PUBLIC_STATE, players: [] },
      },
    });
    await flushPromises();

    staleState.resolve(PLAYER_STATE);
    await flushPromises();
    expect(player.loading.value).toBe(true);

    refreshedInfo.resolve(QUIZ_INFO);
    await flushPromises();
    expect(player.loading.value).toBe(false);
    expect(player.playerId.value).toBeNull();
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

  it("stores the trimmed name after a successful manual join", async () => {
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);
    mockJoinMusicQuiz.mockResolvedValue({
      player_id: "player-id",
      state: PLAYER_STATE,
    });
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    await player.join("  Player One  ");

    expect(mockJoinMusicQuiz).toHaveBeenCalledWith("Player One");
    expect(mockStorePlayerName).toHaveBeenCalledWith(
      "Player One",
      participantContext,
    );
    expect(player.rememberedName.value).toBe("Player One");
  });

  it("serializes concurrent manual joins and allows a later retry", async () => {
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);
    const pendingJoin = deferred<{
      player_id: string;
      state: typeof PLAYER_STATE;
    }>();
    mockJoinMusicQuiz
      .mockReturnValueOnce(pendingJoin.promise)
      .mockResolvedValue({
        player_id: "next-player",
        state: PLAYER_STATE,
      });
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    const firstJoin = player.join("Player");
    await expect(player.join("Player")).resolves.toBe(false);

    expect(mockJoinMusicQuiz).toHaveBeenCalledOnce();
    expect(player.busy.value).toBe(true);

    pendingJoin.resolve({
      player_id: "first-player",
      state: PLAYER_STATE,
    });
    await expect(firstJoin).resolves.toBe(true);
    expect(player.busy.value).toBe(false);

    await player.leave();
    await expect(player.join("Player")).resolves.toBe(true);
    expect(mockJoinMusicQuiz).toHaveBeenCalledTimes(2);
  });

  it("does not auto-join while a manual join is pending", async () => {
    storedPlayerName.value = "Remembered Player";
    const pendingInfo = deferred<typeof QUIZ_INFO>();
    const pendingJoin = deferred<{
      player_id: string;
      state: typeof PLAYER_STATE;
    }>();
    mockGetMusicQuizInfo.mockReturnValue(pendingInfo.promise);
    mockJoinMusicQuiz.mockReturnValue(pendingJoin.promise);
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    const manualJoin = player.join("Manual Player");
    pendingInfo.resolve(QUIZ_INFO);
    await flushPromises();

    expect(mockJoinMusicQuiz).toHaveBeenCalledOnce();
    expect(mockJoinMusicQuiz).toHaveBeenCalledWith("Manual Player");

    pendingJoin.resolve({
      player_id: "manual-player",
      state: PLAYER_STATE,
    });
    await expect(manualJoin).resolves.toBe(true);
    expect(player.busy.value).toBe(false);
  });

  it("automatically joins an active game once with the remembered name", async () => {
    storedPlayerName.value = "Player";
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);
    mockJoinMusicQuiz.mockResolvedValue({
      player_id: "auto-player",
      state: PLAYER_STATE,
    });

    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    expect(mockJoinMusicQuiz).toHaveBeenCalledOnce();
    expect(mockJoinMusicQuiz).toHaveBeenCalledWith("Player");
    expect(player.playerId.value).toBe("auto-player");
    expect(player.state.value).toEqual(PLAYER_STATE);
    expect(mockStorePlayerName).not.toHaveBeenCalled();
  });

  it("does not retry or notify after automatic join fails", async () => {
    storedPlayerName.value = "Player";
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);
    mockJoinMusicQuiz.mockRejectedValue(new Error("Name already taken"));
    const notifyError = vi.fn();

    const player = useMusicQuizPlayer({ notifyError });
    await flushPromises();

    providerHandlers[0]({
      object_id: "quiz-instance",
      data: { event: "game_updated", state: PUBLIC_STATE },
    });
    providerHandlers[0]({
      object_id: "quiz-instance",
      data: { event: "game_updated", state: PUBLIC_STATE },
    });
    await flushPromises();

    expect(mockJoinMusicQuiz).toHaveBeenCalledOnce();
    expect(notifyError).not.toHaveBeenCalled();
    expect(player.info.value).toEqual(QUIZ_INFO);
    expect(player.playerId.value).toBeNull();
    expect(player.rememberedName.value).toBe("Player");
  });

  it("automatically joins the next game after removal", async () => {
    storedPlayerName.value = "Player";
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);
    mockJoinMusicQuiz
      .mockResolvedValueOnce({
        player_id: "first-player",
        state: PLAYER_STATE,
      })
      .mockResolvedValueOnce({
        player_id: "next-player",
        state: PLAYER_STATE,
      });
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    providerHandlers[0]({
      object_id: "quiz-instance",
      data: { event: "game_removed" },
    });
    providerHandlers[0]({
      object_id: "quiz-instance",
      data: { event: "game_updated", state: PUBLIC_STATE },
    });
    await flushPromises();

    expect(mockJoinMusicQuiz).toHaveBeenCalledTimes(2);
    expect(mockJoinMusicQuiz).toHaveBeenNthCalledWith(2, "Player");
    expect(player.playerId.value).toBe("next-player");
    expect(storedPlayerId.value).toBe("next-player");
  });

  it("does not keep the next game busy while an old join is pending", async () => {
    storedPlayerName.value = "Player";
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);
    const oldJoin = deferred<{
      player_id: string;
      state: typeof PLAYER_STATE;
    }>();
    mockJoinMusicQuiz
      .mockReturnValueOnce(oldJoin.promise)
      .mockResolvedValueOnce({
        player_id: "next-player",
        state: PLAYER_STATE,
      });
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();
    expect(player.busy.value).toBe(true);

    providerHandlers[0]({
      object_id: "quiz-instance",
      data: { event: "game_removed" },
    });
    providerHandlers[0]({
      object_id: "quiz-instance",
      data: { event: "game_updated", state: PUBLIC_STATE },
    });
    await flushPromises();

    expect(mockJoinMusicQuiz).toHaveBeenCalledTimes(2);
    expect(mockJoinMusicQuiz).toHaveBeenNthCalledWith(2, "Player");
    expect(player.playerId.value).toBe("next-player");
    expect(player.busy.value).toBe(false);

    oldJoin.resolve({
      player_id: "old-player",
      state: PLAYER_STATE,
    });
    await flushPromises();

    expect(player.playerId.value).toBe("next-player");
    expect(player.busy.value).toBe(false);
  });

  it("does not auto-join when info resolves after unmount", async () => {
    storedPlayerName.value = "Player";
    const pendingInfo = deferred<typeof QUIZ_INFO>();
    mockGetMusicQuizInfo.mockReturnValue(pendingInfo.promise);
    useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    unmountHandlers[0]();
    pendingInfo.resolve(QUIZ_INFO);
    await flushPromises();

    expect(mockJoinMusicQuiz).not.toHaveBeenCalled();
    expect(mockStorePlayerId).not.toHaveBeenCalled();
  });

  it("ignores an automatic join that resolves after unmount", async () => {
    storedPlayerName.value = "Player";
    mockGetMusicQuizInfo.mockResolvedValue(QUIZ_INFO);
    const pendingJoin = deferred<{
      player_id: string;
      state: typeof PLAYER_STATE;
    }>();
    mockJoinMusicQuiz.mockReturnValue(pendingJoin.promise);
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    unmountHandlers[0]();
    pendingJoin.resolve({
      player_id: "late-player",
      state: PLAYER_STATE,
    });
    await flushPromises();

    expect(mockStorePlayerId).not.toHaveBeenCalled();
    expect(mockHeartbeatMusicQuiz).not.toHaveBeenCalled();
    expect(player.playerId.value).toBeNull();
    expect(player.state.value).toBeNull();
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
    expect(player.rememberedName.value).toBe("Player");
    expect(storedPlayerName.value).toBe("Player");
  });

  it("clears loading when leaving during a state fetch", async () => {
    storedPlayerId.value = "stored-player";
    mockGetMusicQuizState.mockResolvedValueOnce(PLAYER_STATE);
    const pendingState = deferred<typeof PLAYER_STATE>();
    mockGetMusicQuizState.mockReturnValueOnce(pendingState.promise);
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    void player.fetchState();
    await flushPromises();
    expect(player.loading.value).toBe(true);

    await player.leave();
    expect(player.loading.value).toBe(false);

    pendingState.resolve(PLAYER_STATE);
    await flushPromises();
    expect(player.loading.value).toBe(false);
    expect(player.state.value).toBeNull();
  });

  it("stops heartbeat when unmounted", async () => {
    storedPlayerId.value = "stored-player";
    mockGetMusicQuizState.mockResolvedValue(PLAYER_STATE);
    useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledTimes(1);
    const unmount = unmountHandlers.shift();
    if (!unmount) throw new Error("Expected an unmount handler");
    unmount();
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
    expect(mockHeartbeatMusicQuiz).toHaveBeenNthCalledWith(2, "second-player");

    await vi.advanceTimersByTimeAsync(15_000);
    expect(mockHeartbeatMusicQuiz).toHaveBeenNthCalledWith(3, "second-player");

    firstHeartbeat.resolve(false);
    await flushPromises();
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
    mockGetMusicQuizState
      .mockResolvedValueOnce(PLAYER_STATE)
      .mockResolvedValueOnce(answeredState);
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

  it("serializes concurrent answers and allows a later retry", async () => {
    storedPlayerId.value = "stored-player";
    const pendingAnswer = deferred<typeof PLAYER_STATE>();
    mockGetMusicQuizState.mockResolvedValue(PLAYER_STATE);
    mockAnswerMusicQuiz
      .mockReturnValueOnce(pendingAnswer.promise)
      .mockResolvedValue(PLAYER_STATE);
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();
    const submission = {
      answer_type: "multiple_choice",
      suggestion_id: "suggestion-1",
    } as const;

    const firstAnswer = player.submitAnswer(submission);
    await expect(player.submitAnswer(submission)).resolves.toBe(false);

    expect(mockAnswerMusicQuiz).toHaveBeenCalledOnce();
    expect(player.busy.value).toBe(true);

    pendingAnswer.resolve(PLAYER_STATE);
    await expect(firstAnswer).resolves.toBe(true);
    expect(player.busy.value).toBe(false);

    await expect(player.submitAnswer(submission)).resolves.toBe(true);
    expect(mockAnswerMusicQuiz).toHaveBeenCalledTimes(2);
  });

  it("does not re-enable stale controls when action refresh fails", async () => {
    storedPlayerId.value = "stored-player";
    mockGetMusicQuizState
      .mockResolvedValueOnce(PLAYER_STATE)
      .mockRejectedValueOnce(new Error("Refresh failed"));
    mockAnswerMusicQuiz.mockResolvedValue(PLAYER_STATE);
    const notifyError = vi.fn();
    const player = useMusicQuizPlayer({ notifyError });
    await flushPromises();

    await expect(
      player.submitAnswer({
        answer_type: "multiple_choice",
        suggestion_id: "suggestion-1",
      }),
    ).resolves.toBe(false);

    expect(player.state.value).toBeNull();
    expect(player.busy.value).toBe(false);
    expect(notifyError).toHaveBeenCalledWith("Refresh failed");
  });

  it("routes timeline actions through the generic submission command", async () => {
    storedPlayerId.value = "stored-player";
    const timelineState = {
      quiz_type: "music_timeline",
      answer_type: "timeline",
      phase: "answering",
      name: "Music Timeline",
      round_count: 1,
      answer_duration: 30,
      artist_bonus_mode: "off",
      title_bonus_mode: "off",
      mode: "venue",
      players: [],
      current_round: {
        round_index: 0,
        started_at: 1,
        deadline: 31,
        auto_advance_at: null,
        question: null,
        timeline: [],
        bonus_definitions: [],
      },
      you: {
        name: "Player",
        score: 0,
        ready: false,
        active_from_round: 0,
      },
    } as const;
    const submission = {
      answer_type: "timeline",
      action: "place",
      previous_entry_id: null,
      next_entry_id: "anchor",
    } as const;
    mockGetMusicQuizState.mockResolvedValue(timelineState);
    mockSubmitMusicQuizAnswer.mockResolvedValue(timelineState);

    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();
    await player.submitAnswer(submission);

    expect(mockSubmitMusicQuizAnswer).toHaveBeenCalledWith(
      "stored-player",
      submission,
    );
    expect(mockAnswerMusicQuiz).not.toHaveBeenCalled();
    expect(mockGetMusicQuizState).toHaveBeenCalledTimes(2);
    expect(player.state.value).toEqual(timelineState);

    providerHandlers[0]({
      object_id: "quiz-instance",
      data: {
        event: "game_updated",
        state: {
          ...timelineState,
          players: [
            {
              name: "Player",
              score: 0,
              ready: false,
              answered: true,
              placed: true,
              artist_bonus_answered: false,
              title_bonus_answered: false,
            },
          ],
        },
      },
    });
    await flushPromises();

    expect(mockHeartbeatMusicQuiz).toHaveBeenCalledWith("stored-player");
    expect(mockGetMusicQuizState).toHaveBeenCalledTimes(3);
    expect(player.state.value?.quiz_type).toBe("music_timeline");
  });

  it("keeps a reveal authoritative over a delayed answer response", async () => {
    storedPlayerId.value = "stored-player";
    const delayedAnswer = deferred<typeof TIMELINE_PLACED_STATE>();
    const eventRefresh = deferred<typeof TIMELINE_PLACED_STATE>();
    mockGetMusicQuizState
      .mockResolvedValueOnce(TIMELINE_ANSWERING_STATE)
      .mockReturnValueOnce(eventRefresh.promise)
      .mockResolvedValueOnce(TIMELINE_REVEAL_STATE)
      .mockResolvedValueOnce(TIMELINE_REVEAL_STATE);
    mockSubmitMusicQuizAnswer.mockReturnValueOnce(delayedAnswer.promise);
    mockReadyMusicQuiz.mockResolvedValue(TIMELINE_REVEAL_STATE);
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    const submitting = player.submitAnswer({
      answer_type: "timeline",
      action: "place",
      previous_entry_id: "anchor",
      next_entry_id: null,
    });
    providerHandlers[0]({
      object_id: "quiz-instance",
      data: { event: "game_updated", state: TIMELINE_REVEAL_STATE },
    });
    await flushPromises();
    delayedAnswer.resolve(TIMELINE_PLACED_STATE);
    await flushPromises();
    expect(player.busy.value).toBe(true);
    eventRefresh.resolve(TIMELINE_PLACED_STATE);
    await submitting;

    expect(player.state.value).toEqual(TIMELINE_REVEAL_STATE);
    expect(player.busy.value).toBe(false);

    await expect(player.ready()).resolves.toBe(true);
    expect(mockReadyMusicQuiz).toHaveBeenCalledWith("stored-player");
    expect(player.state.value).toEqual(TIMELINE_REVEAL_STATE);
  });

  it("keeps a successful next-round event authoritative over delayed Ready", async () => {
    storedPlayerId.value = "stored-player";
    const delayedReady = deferred<typeof TIMELINE_REVEAL_STATE>();
    const eventRefresh = deferred<typeof TIMELINE_REVEAL_STATE>();
    mockGetMusicQuizState
      .mockResolvedValueOnce(TIMELINE_REVEAL_STATE)
      .mockReturnValueOnce(eventRefresh.promise)
      .mockResolvedValueOnce(TIMELINE_NEXT_STATE);
    mockReadyMusicQuiz.mockReturnValueOnce(delayedReady.promise);
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    const markingReady = player.ready();
    providerHandlers[0]({
      object_id: "quiz-instance",
      data: { event: "game_updated", state: TIMELINE_NEXT_STATE },
    });
    await flushPromises();
    delayedReady.resolve(TIMELINE_REVEAL_STATE);
    await flushPromises();
    expect(player.busy.value).toBe(true);
    eventRefresh.resolve(TIMELINE_REVEAL_STATE);
    await markingReady;

    expect(player.state.value).toEqual(TIMELINE_NEXT_STATE);
    expect(player.busy.value).toBe(false);
  });

  it("sends Ready only once while the first request is in flight", async () => {
    storedPlayerId.value = "stored-player";
    const delayedReady = deferred<typeof TIMELINE_REVEAL_STATE>();
    mockGetMusicQuizState.mockResolvedValue(TIMELINE_REVEAL_STATE);
    mockReadyMusicQuiz.mockReturnValueOnce(delayedReady.promise);
    const player = useMusicQuizPlayer({ notifyError: vi.fn() });
    await flushPromises();

    const firstReady = player.ready();
    await expect(player.ready()).resolves.toBe(false);

    expect(mockReadyMusicQuiz).toHaveBeenCalledOnce();
    expect(mockReadyMusicQuiz).toHaveBeenCalledWith("stored-player");

    delayedReady.resolve(TIMELINE_REVEAL_STATE);
    await expect(firstReady).resolves.toBe(true);
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
